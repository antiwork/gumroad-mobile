export const API_ENDPOINTS = {
    PURCHASES: {
        SEARCH: "mobile/purchases/search",
        CREATORS: "mobile/purchases/creators",
        REDIRECT_ATTRIBUTES: (id: string | number) => `mobile/url_redirects/get_url_redirect_attributes/${id}`,
    },
};
