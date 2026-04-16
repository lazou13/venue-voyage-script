import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, User, Loader2, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  action_taken?: string | null;
  ts: number;
}

const QUICK_ACTIONS = [
  "Combien de POIs ont un audio EN manquant ?",
  "Donne-moi les stats complètes",
  "Quels sont les derniers logs de l'agent ?",
  "Lance l'agent autonome",
  "Combien de POIs validés sans audio FR ?",
];

export default function AdminAgentChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis l'assistant IA de Hunt Planner Pro. Je peux répondre à vos questions sur les POIs, les audios, les statistiques, et exécuter des actions comme lancer l'agent autonome.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { message: msg, history },
      });

      if (error) throw error;

      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply ?? "Pas de réponse.",
        action_taken: data.action_taken ?? null,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${errMsg}`, ts: Date.now() }]);
      toast({ title: "Erreur", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" /> Agent Chat
          </h2>
          <p className="text-muted-foreground text-sm">Posez des questions sur les POIs, l'agent ou déclenchez des actions</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMessages(prev => [prev[0]])} className="gap-1 text-muted-foreground">
          <Trash2 className="w-3 h-3" /> Effacer
        </Button>
      </div>

      {/* Chat area */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={cn("max-w-[80%] space-y-1", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
                {msg.action_taken && (
                  <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30">
                    <CardContent className="p-2">
                      <p className="text-xs font-mono text-green-700 dark:text-green-400 whitespace-pre-wrap">{msg.action_taken}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((q) => (
          <Button key={q} variant="outline" size="sm" onClick={() => send(q)} disabled={loading} className="text-xs gap-1">
            <Zap className="w-3 h-3" /> {q}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Posez une question ou donnez une instruction..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
