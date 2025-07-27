import { ofetch } from "ofetch";

export const fetch = ofetch.create({
    baseURL: "/api",
});
export { fetch as ofetch };
