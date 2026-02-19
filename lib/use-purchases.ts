import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { assertDefined } from "./assert";
import { useAuth } from "./auth-context";
import { requestAPI, UnauthorizedError } from "./request";

export interface Purchase {
  name: string;
  creator_name: string;
  creator_username: string;
  creator_profile_picture_url: string;
  thumbnail_url: string | null;
  url_redirect_token: string;
  purchase_email: string;
  purchase_id?: string;
  is_archived?: boolean;
  content_updated_at?: string;
  purchased_at?: string;
  file_data?: {
    id: string;
    name: string;
    filegroup?: string;
    streaming_url?: string;
  }[];
}

interface PurchasesResponse {
  success: boolean;
  products: Purchase[];
  user_id: string;
}

const PER_PAGE = 24;

export const usePurchases = () => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useInfiniteQuery<PurchasesResponse, Error, Purchase[], string[], number>({
    queryKey: ["purchases"],
    queryFn: ({ pageParam }) =>
      requestAPI<PurchasesResponse>(`mobile/purchases/index?per_page=${PER_PAGE}&page=${pageParam}`, {
        accessToken: assertDefined(accessToken),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.products.length < PER_PAGE ? undefined : lastPageParam + 1,
    select: (data) => data.pages.flatMap((page) => page.products),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return query;
};

export const usePurchase = (id: string) => {
  const { data: purchases = [] } = usePurchases();
  return purchases.find((p) => p.url_redirect_token === id);
};
