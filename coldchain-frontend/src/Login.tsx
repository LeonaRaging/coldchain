import React, { useState } from "react";
import { signIn, signUp, confirmSignUp } from "aws-amplify/auth"

export default function Login() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, SetLoading] = useState(false);
    const [confirmationCode, setConfirmationCode] = useState("");
    const [needsConfirmation, setNeedsConfirmation] = useState(false);

    async function handleLogin(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();
        setError("");
        SetLoading(true);

        try {
            const result = await signIn({
                username,
                password,
            });

            if (result.isSignedIn) {
                window.location.assign("/dashboard");
            } else {
                setError(
                    "Additional verification is required. Please complete the sign-in challenge."
                );
            }
        } catch {
            setError("Login failed. Check your credentials and try again.");
        } finally {
            SetLoading(false);
        }
    }

    async function handleSignUp() {
        setError("");

        try {
            const result = await signUp({
                username,
                password,
                options: {
                    userAttributes: {
                        email,
                    }
                }
            });

            if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
                setNeedsConfirmation(true);
                setError("Check your email for the confirmation code.");
            }
        } catch {
            setError("Sign up failed. Check your details and try again.")
        }
    }

    async function handleConfirmSignUp(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        try {
            await confirmSignUp({
                username,
                confirmationCode,
            });

            setNeedsConfirmation(false);
            setError("Account confirmed. You can now sign in.");
        } catch {
            setError("Invalid confirmation code.");
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <h1>ColdChain</h1>

                {needsConfirmation ? (
                    <form onSubmit={handleConfirmSignUp}>
                        <label htmlFor="confirmationCode">Confirmation code</label>
                        <input
                            id="confirmationCode"
                            value={confirmationCode}
                            onChange={(event) => setConfirmationCode(event.target.value)}
                            required
                        />
                    </form>
                ) : (
                    <form onSubmit={handleLogin}>
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="text"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="username"
                            required
                        />
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoComplete="username"
                            required
                        />

                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />

                        {error && <p role="alert">{error}</p>}

                        <button type="submit" disabled={loading}>
                            {loading ? "Signing in..." : "Sign in"}
                        </button>

                        <button type="button" onClick={handleSignUp} disabled={loading}>
                            Sign up
                        </button>
                    </form>
                )}
            </section>
        </main>
    )
}