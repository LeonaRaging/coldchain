import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signIn } from "aws-amplify/auth";
import "./Login.css";

type LoginProps = {
    onSignedIn: () => void;
};

export default function Login({ onSignedIn }: LoginProps) {
    const [step, setStep] = useState<"username" | "password">("username");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    function handleNext(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setStep("password");
    }


    function handleBack() {
        setError("");
        setPassword("");
        setShowPassword(false);
        setStep("username");
    }

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn({ username, password });

            if (result.isSignedIn) {
                onSignedIn();
            } else {
                setError(
                    "Additional verification is required. Please complete the sign-in challenge."
                );
            }
        } catch {
            setError("Login failed. Check your credentials and try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                {step === "username" ? (
                    <>
                        <h1>Sign in</h1>
                        <p className="subtitle">Sign in to your account.</p>

                        <form onSubmit={handleNext}>
                            <div className="field">
                                <label htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="Enter username"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                            </div>

                            <button type="submit">Next</button>
                        </form>

                        <p className="auth-link">
                            New user? <Link to="/register">Create an account</Link>
                        </p>
                    </>
                ) : (
                    <>
                        <h1>Enter your password</h1>

                        <form onSubmit={handleLogin}>
                            <div className="field">
                                <label htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="current-password"
                                    autoFocus
                                    required
                                />

                                <div className="field-row">
                                    <label className="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={showPassword}
                                            onChange={(event) => setShowPassword(event.target.checked)}
                                        />
                                        Show password
                                    </label>

                                    <Link to="/forgot-password" state={{ username }}>
                                        Forgot your password?
                                    </Link>
                                </div>
                            </div>

                            {error && <p role="alert">{error}</p>}

                            <div className="actions">
                                <button type="submit" disabled={loading}>
                                    {loading ? "Signing in..." : "Continue"}
                                </button>
                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={handleBack}
                                    disabled={loading}
                                >
                                    Back
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </section>
        </main>
    );
}