import { Amplify } from "aws-amplify";

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: "ap-southeast-1_rnCCGgteA",
            userPoolClientId: "7qopehjd90ptuf01hd7prsg1ul",
            loginWith: {
                email: true,
            }
        }
    }
})