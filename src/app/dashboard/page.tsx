import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/auth0ptions";

export default async function DashboardPage() {
  // Check if the user is logged in
  const session = await getServerSession(authOptions);

  // If there is no session, redirect them back to home
  if (!session) {
    redirect("/");
  }

  // Render dashboard content for logged-in users
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-6">Welcome, {session.user?.name}!</p>

      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-gray-700">
          This is your private dashboard, only accessible after logging in.
        </p>
      </div>
    </main>
  );
}