// server component – do NOT add "use client" here
import GoogleLoginButton from "./components/GoogleLoginButton";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-white">
      <div className="w-full max-w-3xl">
        {/* HERO */}
        <section className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Welcome to Vision Debug Tutor</h1>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Your personal AI Assistant</h2>
          <p className="text-gray-600">Sign in to continue to your dashboard.</p>
        </section>

        {/* LOGIN CARD */}
        <section className="mx-auto max-w-md rounded-2xl border bg-gray-50 p-6 shadow-sm">
          <h2 className="text-center font-semibold text-gray-900 mb-4">Login</h2>
          <GoogleLoginButton />
        </section>

        {/* FEATURES (your previous UI area) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Feature 1</h3>
            <p className="text-sm text-gray-600">Short description.</p>
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Feature 2</h3>
            <p className="text-sm text-gray-600">Short description.</p>
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold mb-2">Feature 3</h3>
            <p className="text-sm text-gray-600">Short description.</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Debug Tutor
        </footer>
      </div>
    </main>
  );
}