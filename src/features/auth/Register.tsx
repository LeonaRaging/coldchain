import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import AuthBrand from "./AuthBrand";


const PASSWORD_RULES = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One number", test: (p: string) => /\d/.test(p) },
    {
        label: "One special character (for example ! @ # $ %)",
        test: (p: string) => /[^A-Za-z0-9]/.test(p),
    },
];

type AuthError = { name?: string; message?: string };


type IncomingState = { username?: string; needsConfirmation?: boolean } | null;

function getSignUpError(err: unknown): string {
    const e = err as AuthError;

    switch (e.name) {
        case "InvalidPasswordException":
            return `Password does not meet the requirements. ${e.message ?? ""}`;
        case "UsernameExistsException":
            return "This username is already taken. Choose another one.";
        case "InvalidParameterException":
            return `Invalid input: ${e.message ?? "check your email and username."}`;
        case "LimitExceededException":
        case "TooManyRequestsException":
            return "Too many attempts. Wait a few minutes and try again.";
        case "NetworkError":
            return "Cannot reach the server. Check your internet connection.";
        default:
            return `${e.name ?? "Error"}: ${e.message ?? "Sign up failed."}`;
    }
}

function getConfirmError(err: unknown): string {
    const e = err as AuthError;

    switch (e.name) {
        case "CodeMismatchException":
            return "Wrong confirmation code. Check your email and try again.";
        case "ExpiredCodeException":
            return "This code has expired. Use “Resend code” to get a new one.";
        case "LimitExceededException":
        case "TooManyRequestsException":
            return "Too many attempts. Wait a few minutes and try again.";
        default:
            return `${e.name ?? "Error"}: ${e.message ?? "Confirmation failed."}`;
    }
}

export default function Register() {
    const navigate = useNavigate();
    const location = useLocation();
    const incoming = location.state as IncomingState;

    const [email, setEmail] = useState("");
    const [username, setUsername] = useState(incoming?.username ?? "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [confirmationCode, setConfirmationCode] = useState("");
    const [needsConfirmation, setNeedsConfirmation] = useState(
        incoming?.needsConfirmation ?? false
    );
    const [message, setMessage] = useState(
        incoming?.needsConfirmation
            ? "Enter the code we emailed you, or choose Resend code."
            : ""
    );

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);



    async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setMessage("");

        const failedRules = PASSWORD_RULES.filter((rule) => !rule.test(password));
        if (failedRules.length > 0) {
            setError(
                `Password is missing: ${failedRules
                    .map((rule) => rule.label.toLowerCase())
                    .join(", ")}.`
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const result = await signUp({
                username,
                password,
                options: {
                    userAttributes: { email },
                },
            });

            if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
                setNeedsConfirmation(true);
                setMessage("Check your email for the confirmation code.");
            } else {
                navigate("/login");
            }
        } catch (err) {
            console.error(err);
            setError(getSignUpError(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirmSignUp(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            await confirmSignUp({ username, confirmationCode });
            navigate("/login");
        } catch (err) {
            console.error(err);
            setError(getConfirmError(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        setError("");

        try {
            await resendSignUpCode({ username });
            setMessage("A new code has been sent to your email.");
        } catch (err) {
            console.error(err);
            setError(getConfirmError(err));
        }
    }

    return (
        <main className="fixed inset-0 z-10 flex overflow-y-auto bg-motive-surface p-5 text-left font-sans text-sm leading-snug text-motive-ink">
            <section className="m-auto flex w-full max-w-sm flex-col gap-2 rounded-xl border border-motive-line bg-white p-7 shadow-sm">
                <AuthBrand />
                {needsConfirmation ? (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Confirm account</h1>
                        {message && <p className="m-0 text-sm text-motive-muted">{message}</p>}

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleConfirmSignUp}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="confirmationCode">Confirmation code</label>
                                <input
                                    id="confirmationCode"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type="text"
                                    placeholder="Enter confirmation code"
                                    value={confirmationCode}
                                    onChange={(event) => setConfirmationCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Confirming..." : "Confirm account"}
                                </button>
                                <button
                                    className="h-10 cursor-pointer rounded-md border border-motive-line bg-white text-sm font-semibold text-motive-ink transition-colors enabled:hover:bg-motive-surface disabled:cursor-not-allowed disabled:opacity-60"
                                    type="button"
                                    onClick={handleResend}
                                    disabled={loading}
                                >
                                    Resend code
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-semibold leading-tight tracking-tight text-motive-ink">Sign up</h1>
                        <p className="m-0 text-sm text-motive-muted">Create a new account.</p>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleSignUp}>
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
                                    }}
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="email">Email address</label>
                                <input
                                    id="email"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type="email"
                                    placeholder="Enter email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    aria-describedby="password-rules"
                                    required
                                />
                                {password.length > 0 && (
                                    <ul id="password-rules" className="m-0 list-none p-0 text-xs text-motive-muted">
                                        {PASSWORD_RULES.map((rule) => {
                                            const passed = rule.test(password);
                                            return (
                                                <li key={rule.label} className={passed ? "text-emerald-600" : ""}>
                                                    {passed ? "✓" : "✗"} {rule.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-motive-ink" htmlFor="confirmPassword">Confirm password</label>
                                <input
                                    id="confirmPassword"
                                    className="h-10 w-full rounded-md border border-motive-line bg-white px-3 text-sm text-motive-ink outline-none transition-shadow placeholder:text-gray-400 focus:border-motive-blue focus:ring-2 focus:ring-motive-blue/15"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                                <input
                                    className="m-0 h-4 w-4 rounded p-0 accent-motive-blue"
                                    type="checkbox"
                                    checked={showPassword}
                                    onChange={(event) => setShowPassword(event.target.checked)}
                                />
                                Show password
                            </label>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <button className="h-10 cursor-pointer rounded-md border-none bg-motive-blue text-sm font-semibold text-white transition-colors enabled:hover:bg-motive-blue-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Creating account..." : "Sign up"}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                <p className="m-0 mt-1 text-center text-sm text-motive-muted">
                    Have an account already? <Link className="text-motive-blue no-underline hover:underline" to="/login">Sign in</Link>
                </p>
            </section>
        </main>
    );
}
