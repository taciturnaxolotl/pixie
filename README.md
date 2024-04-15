# The Pixie: a bag adventure

You can see the analytics [here](https://view.flatypus.me/95aac8de-d3fd-4fa0-85d5-2a704ae53288)

This is a website I'm creating for the Hackclub bag game to be used for scavanger hunts at hackathons. More info comming soon as well as docs.

# Running Yourself

1. First you need to clone the repo and deploy your repo on netlify, it will likely fail the first time because you haven't configured any environment variables yet.

2. You then need to create a slack app with the user token oauth perm: profile. You also need to add several redirect urls to your slack app: http://localhost:8888/.netlify/functions/magic-dust and https://<your prod site url>/.netlify/functions/magic-dust. Slack will tell you that you can't add non https redirect urls but if you right click on the submit button thats disabled and in the dev tools remove the class disabled and the disabled property then you can still submit it.

3. You need to add these environment variables to your netlify environment variables tab for your new site:
```env
    ADMIN_CODE=<The Password to access the /admin dashboard>
    AIRTABLE_API_KEY=<Your Airtable API Key with the scopes read and write>
    AIRTABLE_BASE_ID=<The base id of your airtable table>
    BAG_APP_ID<Your Bag App id which you can get from slack>
    BAG_APP_KEY<Your Bag App Key>
    BAG_IDENTITY_ID=<The identity of the person you want to give out items from>
    BASEURL=<The Base URL has 4 different values for different deploy contexts: Production: your prod site url, Deploy Previews: preview, Branch deploys: preview, Local (Netlify CLI): http://localhost:8888>
    FLATY_PIXEL=<The id you get from https://view.flatypus.me/>
    SLACK_CLIENT_ID=<The client id of your slack app>
    SLACK_CLIENT_SECRET=<The client secret of your slack app>
```

4. Link your netlify site to your local repo with `ntl login && ntl link` then you can run localy with `ntl dev`