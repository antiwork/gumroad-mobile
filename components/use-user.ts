import { useAPIRequest } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";

interface User {
  bio: string | null;
  twitter_handle: string | null;
  name: string;
  user_id: string;
  email: string;
  url: string;
  profile_url: string;
  profile_picture_url: string | null;
}

interface UserResponse {
  success: boolean;
  user: User;
}

export const useUser = () => {
  const query = useAPIRequest<UserResponse, User>({
    queryKey: ["user"],
    url: "v2/user",
    select: (data) => data.user,
  });

  useEffect(() => {
    if (query.data) {
      Sentry.setUser({
        id: query.data.user_id,
        email: query.data.email,
        username: query.data.name,
      });
    }
  }, [query.data]);

  return query;
};
