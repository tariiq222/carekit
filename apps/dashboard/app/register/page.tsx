import { RegisterForm } from "@/components/features/register-form"

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <RegisterForm />
      </div>
    </main>
  )
}
