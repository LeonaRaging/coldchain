import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";


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
        <main className="fixed inset-0 z-10 flex overflow-y-auto bg-gray-100 p-5 text-left font-sans text-sm leading-snug text-gray-900">
            <section className="m-auto box-border flex w-full max-w-sm flex-col gap-2 rounded-lg border border-gray-300 bg-white p-6">
                {needsConfirmation ? (
                    <>
                        <h1 className="m-0 mb-1 text-left text-2xl font-bold leading-tight tracking-normal text-gray-900">Confirm account</h1>
                        {message && <p className="m-0 text-sm text-gray-900">{message}</p>}

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleConfirmSignUp}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-gray-900" htmlFor="confirmationCode">Confirmation code</label>
                                <input
                                    id="confirmationCode"
                                    className="box-border h-8 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none placeholder:italic placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                                <button className="h-8 cursor-pointer rounded border-none bg-blue-600 text-sm font-bold text-white transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Confirming..." : "Confirm account"}
                                </button>
                                <button
                                    className="h-8 cursor-pointer rounded border-2 border-blue-600 bg-white text-sm font-bold text-blue-600 transition-colors enabled:hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                        <h1 className="m-0 mb-1 text-left text-2xl font-bold leading-tight tracking-normal text-gray-900">Sign up</h1>
                        <p className="m-0 text-sm text-gray-900">Create a new account.</p>

                        <form className="mt-2 flex flex-col gap-4" onSubmit={handleSignUp}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-gray-900" htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    className="box-border h-8 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none placeholder:italic placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                                <label className="text-sm font-bold text-gray-900" htmlFor="email">Email address</label>
                                <input
                                    id="email"
                                    className="box-border h-8 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none placeholder:italic placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                    type="email"
                                    placeholder="Enter email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-gray-900" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="box-border h-8 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none placeholder:italic placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    aria-describedby="password-rules"
                                    required
                                />
                                {password.length > 0 && (
                                    <ul id="password-rules" className="m-0 list-none p-0 text-sm text-gray-500">
                                        {PASSWORD_RULES.map((rule) => {
                                            const passed = rule.test(password);
                                            return (
                                                <li key={rule.label} className={passed ? "text-green-700" : ""}>
                                                    {passed ? "✓" : "✗"} {rule.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-bold text-gray-900" htmlFor="confirmPassword">Confirm password</label>
                                <input
                                    id="confirmPassword"
                                    className="box-border h-8 w-full rounded-md border border-gray-400 bg-white px-3 text-sm text-gray-900 outline-none placeholder:italic placeholder:text-gray-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                                    className="m-0 h-4 w-4 p-0 accent-blue-600"
                                    type="checkbox"
                                    checked={showPassword}
                                    onChange={(event) => setShowPassword(event.target.checked)}
                                />
                                Show password
                            </label>

                            {error && <p className="m-0 text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <button className="h-8 cursor-pointer rounded border-none bg-blue-600 text-sm font-bold text-white transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                                    {loading ? "Creating account..." : "Sign up"}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                <p className="m-0 mt-1 text-center text-sm text-gray-900">
                    Have an account already? <Link className="text-blue-600 no-underline hover:underline" to="/login">Sign in</Link>
                </p>
            </section>
        </main>
    );
}
