import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signUp, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import {
    authActions,
    authButton,
    authButtonSecondary,
    authCard,
    authCheckbox,
    authCheckboxInput,
    authError,
    authField,
    authForm,
    authInput,
    authLabel,
    authLink,
    authLinkRow,
    authPage,
    authRuleOk,
    authRules,
    authSubtitle,
    authTitle,
} from "./authStyles";


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
        <main className={authPage}>
            <section className={authCard}>
                {needsConfirmation ? (
                    <>
                        <h1 className={authTitle}>Confirm account</h1>
                        {message && <p className={authSubtitle}>{message}</p>}

                        <form className={authForm} onSubmit={handleConfirmSignUp}>
                            <div className={authField}>
                                <label className={authLabel} htmlFor="confirmationCode">Confirmation code</label>
                                <input
                                    id="confirmationCode"
                                    className={authInput}
                                    type="text"
                                    placeholder="Enter confirmation code"
                                    value={confirmationCode}
                                    onChange={(event) => setConfirmationCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    required
                                />
                            </div>

                            {error && <p className={authError} role="alert">{error}</p>}

                            <div className={authActions}>
                                <button className={authButton} type="submit" disabled={loading}>
                                    {loading ? "Confirming..." : "Confirm account"}
                                </button>
                                <button
                                    className={authButtonSecondary}
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
                        <h1 className={authTitle}>Sign up</h1>
                        <p className={authSubtitle}>Create a new account.</p>

                        <form className={authForm} onSubmit={handleSignUp}>
                            <div className={authField}>
                                <label className={authLabel} htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    className={authInput}
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

                            <div className={authField}>
                                <label className={authLabel} htmlFor="email">Email address</label>
                                <input
                                    id="email"
                                    className={authInput}
                                    type="email"
                                    placeholder="Enter email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className={authField}>
                                <label className={authLabel} htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className={authInput}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    aria-describedby="password-rules"
                                    required
                                />
                                {password.length > 0 && (
                                    <ul id="password-rules" className={authRules}>
                                        {PASSWORD_RULES.map((rule) => {
                                            const passed = rule.test(password);
                                            return (
                                                <li key={rule.label} className={passed ? authRuleOk : ""}>
                                                    {passed ? "✓" : "✗"} {rule.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className={authField}>
                                <label className={authLabel} htmlFor="confirmPassword">Confirm password</label>
                                <input
                                    id="confirmPassword"
                                    className={authInput}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            <label className={authCheckbox}>
                                <input
                                    className={authCheckboxInput}
                                    type="checkbox"
                                    checked={showPassword}
                                    onChange={(event) => setShowPassword(event.target.checked)}
                                />
                                Show password
                            </label>

                            {error && <p className={authError} role="alert">{error}</p>}

                            <div className={authActions}>
                                <button className={authButton} type="submit" disabled={loading}>
                                    {loading ? "Creating account..." : "Sign up"}
                                </button>
                            </div>
                        </form>
                    </>
                )}

                <p className={authLinkRow}>
                    Have an account already? <Link className={authLink} to="/login">Sign in</Link>
                </p>
            </section>
        </main>
    );
}