import { useParams } from 'react-router';
import { ProductForm } from '../components/ProductForm';

export function ProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isEdit ? 'Edit Product' : 'New Product'}
      </h1>
      <ProductForm productId={id} />
    </div>
  );
}
