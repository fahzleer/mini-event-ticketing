import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { type } from "arktype"
import { RegisterSchema } from "@repo/types"
import type { User } from "@repo/types"
import { useRegister } from "../hooks/useAuth"

type PasswordValidation = {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  specialChar: boolean
}

const RULES: { label: string; key: keyof PasswordValidation }[] = [
  { label: "8+ characters", key: "length" },
  { label: "One uppercase letter (A–Z)", key: "uppercase" },
  { label: "One lowercase letter (a–z)", key: "lowercase" },
  { label: "One number (0–9)", key: "number" },
  { label: "One special character (!@#$%^&*)", key: "specialChar" },
]

function checkPassword(password: string): PasswordValidation {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[!@#$%^&*]/.test(password),
  }
}

type Props = { onLogin: (token: string, user: User) => void }

export function Register({ onLogin }: Props) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: "", password: "", name: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState("")

  const { mutate: register, isPending, error } = useRegister((token, user) => {
    onLogin(token, user)
    void navigate("/")
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError("")

    // ArkType + ArkRegex validate on frontend before sending
    const result = RegisterSchema(form)
    if (result instanceof type.errors) {
      setValidationError(
        result.summary.includes("password")
          ? "Password needs 8+ chars, one uppercase letter, and one number."
          : result.summary
      )
      return
    }

    register(form)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">Sign up</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full border rounded px-3 py-2 pr-10"
                placeholder="Min 8 chars, with A-Z and 0-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <title>Hide password</title>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M4 4l16 16" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <title>Show password</title>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {form.password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {RULES.map(({ label, key }) => {
                  const passed = checkPassword(form.password)[key]
                  return (
                    <li key={key} className={`text-xs flex items-center gap-1 ${passed ? "text-green-600" : "text-gray-400"}`}>
                      <span>{passed ? "✓" : "○"}</span>
                      {label}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {(validationError || error) && (
            <p className="text-red-600 text-sm">
              {validationError || (error as Error).message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Signing up..." : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
