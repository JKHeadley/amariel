import { ResponseRefinement } from '@/components/admin/ResponseRefinement';
import { useRouter } from 'next/router';

export default function ResponsePage() {
  const router = useRouter();
  const { chatId } = router.query;

  if (!chatId || typeof chatId !== 'string') {
    return null;
  }

  return <ResponseRefinement chatId={chatId} />;
} 