import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export interface SellerProduct {
  id: string;
  name: string;
  permalink: string;
  price_formatted: string;
  status: "published" | "unpublished" | "preorder";
  thumbnail_url: string | null;
  can_edit: boolean;
  can_destroy: boolean;
}

interface ProductsResponse {
  success: boolean;
  products: SellerProduct[];
  pagination: {
    count: number;
    page: number;
    pages: number;
    next: number | null;
  };
}

export const PRODUCTS_QUERY_KEY = ["seller-products"] as const;

export const buildProductsPath = (page: number) => `mobile/products.json?page=${page}`;

export const deleteProductRequest = (id: string, accessToken: string) =>
  requestAPI<{ success: boolean }>(`mobile/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });

export const useProducts = (enabled = true) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useInfiniteQuery<ProductsResponse, Error>({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      requestAPI<ProductsResponse>(buildProductsPath(pageParam as number), {
        accessToken: assertDefined(accessToken),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.next ?? undefined,
    enabled: !!accessToken && enabled,
    placeholderData: keepPreviousData,
  });

  const products = useMemo(() => query.data?.pages.flatMap((page) => page.products) ?? [], [query.data]);
  const totalCount = query.data?.pages[0]?.pagination.count ?? 0;

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return { ...query, products, totalCount };
};

export const useDeleteProduct = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProductRequest(id, assertDefined(accessToken)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });
};
