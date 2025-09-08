import NextAuth from "next-auth";
import { authOptions } from "./auth0ptions";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };