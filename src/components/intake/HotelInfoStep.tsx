import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  hotel_name: z.string().min(1, 'Nom requis').max(100),
  city: z.string().min(1, 'Ville requise').max(100),
  floors: z.coerce.number().min(1).max(100),
  visit_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface HotelInfoStepProps {
  projectId: string;
}

export function HotelInfoStep({ projectId }: HotelInfoStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      hotel_name: project?.hotel_name || '',
      city: project?.city || '',
      floors: project?.floors || 1,
      visit_date: project?.visit_date || '',
    },
  });

  const onSubmit = (data: FormData) => {
    updateProject.mutate(data, {
      onSuccess: () => {
        toast({ title: 'Sauvegardé', description: 'Informations hôtel mises à jour' });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations Hôtel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hotel_name">Nom de l'hôtel *</Label>
            <Input
              id="hotel_name"
              {...register('hotel_name')}
              placeholder="Grand Hôtel Paris"
            />
            {errors.hotel_name && (
              <p className="text-destructive text-xs">{errors.hotel_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ville *</Label>
            <Input id="city" {...register('city')} placeholder="Paris" />
            {errors.city && (
              <p className="text-destructive text-xs">{errors.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="floors">Nombre d'étages *</Label>
            <Input
              id="floors"
              type="number"
              min={1}
              max={100}
              {...register('floors')}
            />
            {errors.floors && (
              <p className="text-destructive text-xs">{errors.floors.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit_date">Date de visite</Label>
            <Input id="visit_date" type="date" {...register('visit_date')} />
          </div>

          <Button type="submit" disabled={!isDirty || updateProject.isPending}>
            Sauvegarder
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
