import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "aws-amplify/auth";
import "./Login.css";

type LoginProps = {
    onSignedIn: () => void;
};

type AuthError = { name?: string; message?: string };

function getLoginError(err: unknown): string {
    const e = err as AuthError;

    switch (e.name) {
        case "UserNotFoundException":
            return "No account found with this username.";
        case "NotAuthorizedException":
            if (e.message?.includes("disabled")) {
                return "This account is disabled. Contact an administrator.";
            }
            if (e.message?.includes("attempts exceeded")) {
                return "Too many failed attempts. Wait a few minutes and try again.";
            }
            return "Incorrect username or password.";
        case "PasswordResetRequiredException":
            return "You need to reset your password. Use “Forgot your password?”.";
        case "UserAlreadyAuthenticatedException":
            return "You are already signed in. Reload the page.";
        case "LimitExceededException":
        case "TooManyRequestsException":
            return "Too many attempts. Wait a few minutes and try again.";
        case "NetworkError":
            return "Cannot reach the server. Check your internet connection.";
        default:
            return `${e.name ?? "Error"}: ${e.message ?? "Login failed."}`;
    }
}

export default function Login({ onSignedIn }: LoginProps) {
    const navigate = useNavigate();

    const [step, setStep] = useState<"username" | "password">("username");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [needsConfirm, setNeedsConfirm] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    function handleNext(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setStep("password");
    }

    function handleBack() {
        setError("");
        setNeedsConfirm(false);
        setPassword("");
        setShowPassword(false);
        setStep("username");
    }

    function goToConfirm() {
        navigate("/register", { state: { username, needsConfirmation: true } });
    }

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setNeedsConfirm(false);
        setLoading(true);

        try {
            const result = await signIn({ username, password });

            if (result.isSignedIn) {
                onSignedIn();
            } else if ((result.nextStep.signInStep as string) === "CONFIRM_SIGN_UP") {
                setError("Your account is not confirmed yet.");
                setNeedsConfirm(true);
            } else {
                setError(
                    "Additional verification is required. Please complete the sign-in challenge."
                );
            }
        } catch (err) {
            console.error(err);
            const e = err as AuthError;

            if (e.name === "UserNotConfirmedException") {
                setError("Your account is not confirmed yet.");
                setNeedsConfirm(true);
            } else if (e.name === "UserNotFoundException") {
                setPassword("");
                setShowPassword(false);
                setStep("username");
                setError(getLoginError(err));
            } else {
                setError(getLoginError(err));
            }
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
                                    onChange={(event) => {
                                        setUsername(event.target.value);
                                        setError("");
                                    }}
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && <p role="alert">{error}</p>}

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

                            {needsConfirm && (
                                <button type="button" onClick={goToConfirm}>
                                    Confirm your account
                                </button>
                            )}

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