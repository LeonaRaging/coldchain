import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "aws-amplify/auth";
import AuthBrand from "./AuthBrand";

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
        <main className="fixed inset-0 z-10 flex overflow-y-auto bg-motive-surface p-5 text-left font-sans text-sm leading-snug text-motive-ink">
            <section className="m-auto flex w-full max-w-sm flex-col gap-2 rounded-xl border border-motive-line bg-white p-7 shadow-sm">
                <AuthBrand />
                {step === "username" ? (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Sign in</h1>
                        <p className="m-0 text-sm text-motive-muted">Sign in to your account.</p>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleNext}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
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

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <button className="mt-1 h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit">Next</button>
                        </form>

                        <p className="m-0 mt-1 text-center text-sm text-motive-muted">
                            New user? <Link className="text-motive-blue no-underline hover:underline" to="/register">Create an account</Link>
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Enter your password</h1>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleLogin}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="current-password"
                                    autoFocus
                                    required
                                />

                                <div className="mt-0.5 flex items-center justify-between gap-3">
                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                        <input
                                            className="m-0 h-4 w-4 rounded p-0 accent-motive-blue"
                                            type="checkbox"
                                            checked={showPassword}
                                            onChange={(event) => setShowPassword(event.target.checked)}
                                        />
                                        Show password
                                    </label>

                                    <Link className="text-motive-blue no-underline hover:underline" to="/forgot-password" state={{ username }}>
                                        Forgot your password?
                                    </Link>
                                </div>
                            </div>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            {needsConfirm && (
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={goToConfirm}>
                                    Confirm your account
                                </button>
                            )}

                            <div className="flex flex-col gap-2">
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Signing in..." : "Continue"}
                                </button>
                                <button
                                    className="h-10 cursor-pointer rounded-md border border-motive-line bg-white text-sm font-semibold text-motive-ink transition-colors enabled:hover:bg-motive-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    type="button"
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
