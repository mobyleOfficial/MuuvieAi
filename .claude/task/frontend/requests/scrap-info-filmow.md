## User Need
Add a button to load information from filmow

## High-Level Requirements
- Add a button called "Get Filmow Information"
- Navigate to a new screen that holds a webview
- This screen (and it's bloc, state, etc) should be placed at ui/profile module
- Open a webview with filmow website login page (https://filmow.com/login/)
- Once the user authenticates, get the cookie from the screen
- If the user don't login and close the webview, don't do anything
- Once the cookies information is retrieved, send it do the backend
- endpoint is a GET called /profile/filmow-information

## Business Value
Enables user to get it's information from filmow

## Priority
High - This is a MUST feature