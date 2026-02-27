const { CognitoUserPool, CognitoUser, AuthenticationDetails } = require('amazon-cognito-identity-js');

const poolData = {
    UserPoolId: 'ap-south-1_YkvAmWJfC',
    ClientId: '3pi3304ng9e5kuqloirqodmthd'
};

const userPool = new CognitoUserPool(poolData);

const authenticationDetails = new AuthenticationDetails({
    Username: 'test@example.com',
    Password: 'Password123!'
});

const cognitoUser = new CognitoUser({
    Username: 'test@example.com',
    Pool: userPool
});

console.log("Attempting authentication...");

cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) => {
        console.log("Success:", result);
    },
    onFailure: (err) => {
        console.log("Failure:", err);
    }
});
