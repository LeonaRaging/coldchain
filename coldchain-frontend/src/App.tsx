import { useEffect, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import Login from "./Login";
import TruckMap from "./TruckMap";

export default function App() {
    const [signedIn, setSignedIn] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        getCurrentUser()
            .then(() => setSignedIn(true))
            .catch(() => setSignedIn(false))
            .finally(() => setCheckingAuth(false));
    }, []);

    if (checkingAuth) {
        return <p>Loading...</p>;
    }

    return signedIn ? <TruckMap /> : <Login />;
}