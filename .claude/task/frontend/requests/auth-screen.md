## User Need
User need to be able to see an auth screen

## High-Level Requirements
- Create a screen to login using google email or facebook
- Get the token received by google email/facebook
- Crete all necessary structure to this new feature (new modules, use cases, data source, etc)
- New modules should be called auth
- In the UI module, the screen should use Login to create the cubit, screen and states
- MOCK all remote data source responses
- Once the OAUTH return the provider/token, send it to the backend 
- This is the expected flow: Frontend App -> Google / Facebook Login SDK -> Identity Token / Access Token -> Your Backend API -> Your JWT Session
- Add a local data source to save the token returned by the backend


## Business Value
Login flow should be created

## Priority
High - This is a MUST feature