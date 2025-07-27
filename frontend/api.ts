import { ofetch } from "ofetch";

export const fetch = ofetch.create({
    baseURL: process.env.NODE_ENV === "development" ? "/api" : "../",
});
export { fetch as ofetch };
