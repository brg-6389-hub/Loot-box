/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Send, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

interface PublishPageProps {
  onPublishSuccess: () => void;
}

const CATEGORIES = ['Fones de ouvido', 'Capa', 'Luvas', 'Suporte', 'Cooler', 'Controles', 'Outro'];

export function PublishPage({ onPublishSuccess }: PublishPageProps) {
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addProduct } = useProducts();
  const { user, isSeller } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();

  const previewPrice = useMemo(() => {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return '0.00 euros';
    return `${value.toFixed(2)} euros`;
  }, [price]);

  // O primeiro elemento da galeria e usado como imagem principal de preview.
  const previewImage = images[0] ?? null;

  const loadFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    void Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((uploadedImages) => {
      setImages((current) => [...current, ...uploadedImages]);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    loadFiles(selectedFiles);
    e.target.value = '';
  };

  const handleDropUpload = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const selectedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    loadFiles(selectedFiles);
  };

  const removeImage = (indexToRemove: number) => {
    setImages((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImages((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [movedImage] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedImage);
      return next;
    });
  };

  const clearImages = () => {
    setImages([]);
  };

  const clearForm = () => {
    setImages([]);
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
  };

  const submitProduct = async (status: 'draft' | 'pending_review') => {
    if (!user || !isSeller) {
      toast({
        title: 'Acesso bloqueado',
        description: 'Apenas distribuidores podem publicar produtos.',
        variant: 'destructive',
      });
      return;
    }
    if (images.length === 0 || !name.trim() || !price || !category) {
      toast({
        title: 'Erro',
        description: 'Preenche os campos obrigatórios e adiciona pelo menos uma foto.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await addProduct({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        images,
        sellerId: user.id,
        status,
      });
    } catch {
      setIsLoading(false);
      toast({
        title: 'Acesso bloqueado',
        description: 'Apenas distribuidores podem publicar produtos.',
        variant: 'destructive',
      });
      return;
    }

    addNotification({
        title: status === 'draft' ? 'Rascunho guardado' : 'Anúncio enviado para revisão',
      message: status === 'draft' ? `"${name.trim()}" ficou guardado em rascunho.` : `"${name.trim()}" ficou pendente até aprovação do administrador.`,
      type: 'success',
    });

    toast({
      title: status === 'draft' ? 'Rascunho guardado' : 'Enviado para revisão',
      description: status === 'draft' ? 'Podes concluir este anúncio mais tarde.' : 'O anúncio vai aparecer na loja depois de ser aprovado.',
    });
    setIsLoading(false);
    clearForm();
    onPublishSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProduct('pending_review');
  };

  return (
    <div className="pb-8 pt-4 px-3 md:px-6 w-full">
      {!user || !isSeller ? (
        <section className="panel-surface p-6">
          <div className="rounded-xl border border-[#3a2525] bg-[#161010] p-6 text-center">
            <h2 className="text-2xl font-bold text-[#E8E0C8]">Acesso reservado a distribuidores</h2>
            <p className="mt-2 text-sm text-[#b4aa90]">Os perfis de cliente podem navegar e comprar, mas não podem publicar produtos.</p>
          </div>
        </section>
      ) : (
      <section className="panel-surface p-4 md:p-6">
        <div className="mb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#E8E0C8]">Publicar Produto</h2>
            <p className="text-sm text-[#7f7661] mt-1">Cria um anúncio elegante e pronto para vender.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-5">
          <aside className="rounded-2xl border border-[#242424] bg-[#111] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#8b8168] mb-3">Preview</p>
            <div className="rounded-xl border border-[#262626] bg-[#0d0d0d] overflow-hidden">
              <div className="aspect-[4/3] bg-[#101010]">
                {previewImage ? (
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#5f5746] gap-2">
                    <ImagePlus className="w-8 h-8" />
                    <span className="text-sm">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-[#1d1d1d]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[#E8E0C8] font-semibold truncate">{name.trim() || 'Nome do produto'}</p>
                  <p className="text-[#d8c28a] font-semibold text-sm whitespace-nowrap">{previewPrice}</p>
                </div>
                <p className="text-xs text-[#7f7661] mt-1 truncate">{category || 'Categoria'}</p>
                <p className="text-sm text-[#9a917a] mt-2 line-clamp-2">{description.trim() || 'Descrição do produto.'}</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <div
                    key={`${index}-${image.slice(0, 24)}`}
                    draggable
                    onDragStart={() => setDraggedImageIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedImageIndex !== null) moveImage(draggedImageIndex, index);
                      setDraggedImageIndex(null);
                    }}
                    onDragEnd={() => setDraggedImageIndex(null)}
                    className={`relative rounded-lg overflow-hidden border bg-[#0d0d0d] aspect-square ${
                      draggedImageIndex === index ? 'border-[#C9A962]' : 'border-[#262626]'
                    }`}
                  >
                    <img src={image} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    {index === 0 && (
                      <span className="absolute left-1 top-1 rounded-full bg-[#C9A962] px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">
                        Principal
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                      aria-label={`Remover foto ${index + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[#262626] bg-[#101010] p-3 flex items-center gap-2 text-[#b8ad90] text-sm">
              <Sparkles className="w-4 h-4 text-[#C9A962]" />
              Dica: fotos claras e de varios angulos ajudam a vender mais rapido.
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#242424] bg-[#111] p-4 md:p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[#A09060]">Fotos do produto</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropUpload}
                className={`w-full h-36 rounded-xl border-2 border-dashed bg-[#0e0e0e] transition-colors flex flex-col items-center justify-center gap-2 ${
                  isDragOver ? 'border-[#C9A962] bg-[#17130b]' : 'border-[#2c2c2c] hover:border-[#C9A962]/60'
                }`}
              >
                <UploadCloud className="w-6 h-6 text-[#8a816a]" />
                <span className="text-sm text-[#8a816a]">Clique ou arraste fotos para aqui</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              <div className="flex items-center justify-between text-xs text-[#7f7661]">
                <span>{images.length} foto(s) selecionada(s)</span>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={clearImages}
                    className="inline-flex items-center gap-1 text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover todas
                  </button>
                )}
              </div>
              {images.length > 1 && (
                <p className="text-xs text-[#7f7661]">Arrasta as miniaturas para definires a ordem e a foto principal.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#A09060]">Nome do produto</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ex: iPhone 14 Pro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#A09060]">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreve o teu produto..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[110px] rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-[#A09060]">Preço (em euros)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-11 rounded-lg bg-[#0A0A0A] border-[#252525] text-[#E8E0C8]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[#A09060]">Categoria</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 rounded-lg border border-[#252525] px-3 bg-[#0A0A0A] text-[#E8E0C8]"
                >
                  <option value="">Selecionar</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Button type="button" onClick={clearForm} className="h-11 rounded-xl border border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:bg-[#1b1b1b]">
                Limpar
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void submitProduct('draft')}
                  className="h-11 rounded-xl border border-[#2b2b2b] bg-[#151515] text-[#E8E0C8] hover:bg-[#1b1b1b]"
                >
                  Guardar rascunho
                </Button>
                <Button type="submit" disabled={isLoading} className="h-11 rounded-xl btn-gold font-semibold">
                  <Send className="w-4 h-4 mr-2" />
                  {isLoading ? 'A publicar...' : 'Publicar'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </section>
      )}
    </div>
  );
}
