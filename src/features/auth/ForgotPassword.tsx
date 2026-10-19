import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import "./Login.css";

type AuthError = { name?: string; message?: string };

function describeError(err: unknown, fallback: string): string {
    const e = err as AuthError;
    return `${e.name ?? "Error"}: ${e.message ?? fallback}`;
}

export default function ForgotPassword() {
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState(
        (location.state as { username?: string } | null)?.username ?? ""
    );
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            await resetPassword({ username });
            setCodeSent(true);
        } catch (err) {
            console.error(err);
            setError(describeError(err, "Could not send the code."));
        } finally {
            setLoading(false);
        }
    }

    async function handleReset(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            await confirmResetPassword({
                username,
                confirmationCode: code,
                newPassword,
            });
            navigate("/login");
        } catch (err) {
            console.error(err);
            setError(describeError(err, "Could not reset the password."));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                {codeSent ? (
                    <>
                        <h1>Reset your password</h1>
                        <p className="subtitle">Enter the code we sent to your email.</p>

                        <form onSubmit={handleReset}>
                            <div className="field">
                                <label htmlFor="code">Confirmation code</label>
                                <input
                                    id="code"
                                    type="text"
                                    placeholder="Enter confirmation code"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="newPassword">New password</label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            {error && <p role="alert">{error}</p>}

                            <button type="submit" disabled={loading}>
                                {loading ? "Saving..." : "Reset password"}
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <h1>Forgot your password?</h1>
                        <p className="subtitle">We will email you a code to reset it.</p>

                        <form onSubmit={handleSendCode}>
                            <div className="field">
                                <label htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="Enter username"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            {error && <p role="alert">{error}</p>}

                            <button type="submit" disabled={loading}>
                                {loading ? "Sending..." : "Send code"}
                            </button>
                        </form>
                    </>
                )}

                <p className="auth-link">
                    <Link to="/login">Back to sign in</Link>
                </p>
            </section>
        </main>
    );
}