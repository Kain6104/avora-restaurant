'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import ArticleEditorForm, { ArticleFormValues } from '../../components/ArticleEditorForm';
import toast from 'react-hot-toast';

export default function EditArticlePage() {
  const params = useParams();
  const { t } = useLanguage();
  const articleId = params?.id as string;
  const [initialValues, setInitialValues] = useState<Partial<ArticleFormValues> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;

    const fetchArticle = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/admin/articles/${articleId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const art = data?.data || data;
          if (art) {
            setInitialValues({
              title: art.title,
              slug: art.slug,
              excerpt: art.excerpt || '',
              content: art.content || '',
              coverImage: art.coverImageUrl || art.coverImage || art.thumbnailUrl || '',
              type: art.articleType || art.type || 'NEWS',
              visibility: art.visibility || 'PUBLIC',
              status: art.status || 'DRAFT',
              scheduledAt: art.scheduledAt,
              promotionStartAt: art.promotionStartAt,
              promotionEndAt: art.promotionEndAt,
              metaTitle: art.seoTitle || art.metaTitle || '',
              metaDescription: art.seoDescription || art.metaDescription || '',
              tags: art.tags || [],
              branchIds: art.branches?.map((b: any) => b.id || b.branchId) || [],
              membershipTierIds: art.membershipTiers?.map((t: any) => t.id || t.membershipTierId) || [],
              products: art.products?.map((p: any) => ({
                productId: p.productId || p.product?.id,
                displayOrder: p.displayOrder,
                highlightNote: p.highlightNote,
                product: p.product,
              })) || [],
              vouchers: art.vouchers?.map((v: any) => ({
                voucherId: v.voucherId || v.voucher?.id,
                customNote: v.customNote,
                voucher: v.voucher,
              })) || [],
            });
          }
        } else {
          toast.error(t('articles.notFound', 'Không tìm thấy bài viết'));
        }
      } catch (err) {
        console.error(err);
        toast.error(t('articles.loadError', 'Lỗi khi tải dữ liệu bài viết'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [articleId, t]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm font-medium animate-pulse">
        {t('articles.loadingInfo', 'Đang tải thông tin bài viết...')}
      </div>
    );
  }

  if (!initialValues) {
    return (
      <div className="py-20 text-center text-slate-500 font-bold">
        {t('articles.notFoundOrNoPermission', 'Không tìm thấy bài viết hoặc bạn không có quyền truy cập')}
      </div>
    );
  }

  return (
    <ArticleEditorForm
      initialValues={initialValues}
      articleId={articleId}
      isEditMode={true}
    />
  );
}
