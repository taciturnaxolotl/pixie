import type { Context } from "@netlify/functions";
import Airtable from "airtable";
import { jwtDecode } from "jwt-decode";

export default async (req: Request, context: Context) => {
    // get the portal from the magicKey cookie
    const magicKey = context.cookies.get("magicKey");
    context.cookies.delete("magicKey");

    // get profile information from the slack callback
    const code = new URLSearchParams(req.url.split("?")[1]).get("code");

    if (code === null) {
        return new Response("Invalid code", { status: 400 });
    }

    console.log(code);

    // exchange the code for an access token
    const slackToken = await (await fetch("https://slack.com/api/openid.connect.token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            code: code,
            client_id: process.env.SLACK_CLIENT_ID as string,
            client_secret: process.env.SLACK_CLIENT_SECRET as string,
            redirect_uri: "https://localhost:8888/.netlify/functions/magic-dust"
        })
    })).json();

    if (!slackToken.ok) {
        return new Response(`Failed to get token: ${slackToken.error}`, { status: 500 });
    }

    type SlackProfile = {
        iss: string,
        sub: string
        aud: string,
        exp: number,
        iat: number,
        auth_time: number,
        nonce: string,
        at_hash: string,
        'https://slack.com/team_id': string,
        'https://slack.com/user_id': string,
        locale: string,
        name: string,
        picture: string,
        given_name: string,
        family_name: string,
        'https://slack.com/team_name': string,
        'https://slack.com/team_domain': string,
        'https://slack.com/team_image_230': string,
        'https://slack.com/team_image_default': boolean
    }

    // decode the id_token as a JWT
    const profile: SlackProfile = jwtDecode(slackToken.id_token);

    interface Portal {
        "Loot Count": number;
        "Name": string;
        "Items": string[];
        "Player Visits": number;
        "Status": string;
        "Loot Amount": number;
    }

    function convertToRecord(obj: any): Portal[] {
        let records: Portal[] = [];

        obj.forEach((record: any) => {
            records.push({
                "Loot Count": record.fields["Loot Count"],
                "Name": record.fields["Name"],
                "Items": record.fields["Items to give out"],
                "Player Visits": record.fields["Player Visits"],
                "Status": record.fields["Status"],
                "Loot Amount": record.fields["Loot Amount"]
            });
        });

        return records;
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID as string);

    // get the valid portals from the Airtable
    const portals = convertToRecord(await base('portals').select({
        // Selecting the first 3 records in Grid view:
        maxRecords: 100,
        view: "Grid view"
    }).all());

    const portal: Portal | undefined = portals.find((record) => record.Name === magicKey);
    // if name = portal, then return the portal
    if (portal === undefined) {
        return new Response(`Portal not found: ${portal}`, { status: 404 });
    }

    const itemsString: string = (portal).Items.map((item, index) => {
        if (index === (portal).Items.length - 1) {
            return item.replace(/^:-/, "").replace(/:$/, "");
        } else if (index === (portal).Items.length - 2) {
            return item.replace(/^:-/, "").replace(/:$/, "") + " and";
        } else {
            return item.replace(/^:-/, "").replace(/:$/, "") + ",";
        }
    }).join(" ");

    const response = {
        statusCode: 302,
        headers: {
            Location: "http://localhost:8888/m/?portal=" + encodeURIComponent(magicKey) + "&count=" + encodeURIComponent(portal["Loot Amount"]) + "&items=" + encodeURIComponent(itemsString) + "&name=" + encodeURIComponent(profile.given_name),
            'Cache-Control': 'no-cache' // Disable caching of this response
        },
        body: '' // return body for local dev
    }

    return new Response(response.body, { status: response.statusCode, headers: response.headers });
};