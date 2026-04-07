import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Star, Send, Loader2 } from 'lucide-react';
import { useQuestPhoto } from '@/hooks/useQuestPhoto';
import { toast } from '@/hooks/use-toast';

interface Props {
  accessToken: string;
  instanceId: string;
  poiId: string;
  poiName: string;
  libraryPoiId?: string | null;
  deviceId?: string | null;
}

export function ClientFeedbackSection({ accessToken, instanceId, poiId, poiName, libraryPoiId, deviceId }: Props) {
  const { uploading, uploadPhoto, submitRecommendation } = useQuestPhoto(accessToken, instanceId);
  const fileRef = useRef<HTMLInputElement>(null);

  // Recommendation form state
  const [showRecForm, setShowRecForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadPhoto(file, libraryPoiId || poiId, deviceId || null);
    if (result.ok) {
      toast({ title: '📸 Photo envoyée !' });
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmitRec = async () => {
    if (rating === 0) {
      toast({ title: 'Ajoutez une note (1-5 étoiles)', variant: 'destructive' });
      return;
    }
    const result = await submitRecommendation({
      poiName,
      medinaPoiId: libraryPoiId || undefined,
      comment: comment.trim() || undefined,
      rating,
    });
    if (result.ok) {
      toast({ title: '⭐ Recommandation envoyée !' });
      setShowRecForm(false);
      setRating(0);
      setComment('');
    } else {
      toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">📱 Votre avis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Photo capture */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
            Prendre une photo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRecForm(!showRecForm)}
            className="flex-1"
          >
            <Star className="w-4 h-4 mr-1" /> Recommander
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Recommendation form */}
        {showRecForm && (
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            {/* Star rating */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Note :</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="p-0.5"
                >
                  <Star
                    className={`w-5 h-5 transition-colors ${n <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
                  />
                </button>
              ))}
              {rating > 0 && <Badge variant="outline" className="ml-2 text-xs">{rating}/5</Badge>}
            </div>
            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire ? (optionnel)"
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none"
              rows={2}
              maxLength={500}
            />
            <Button
              size="sm"
              onClick={handleSubmitRec}
              disabled={uploading || rating === 0}
              className="w-full"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Envoyer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
