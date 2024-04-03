import type { Context } from "@netlify/functions";
import Airtable from "airtable";
import { jwtDecode } from "jwt-decode";
import { App as Bag, Instance, Item } from "@hackclub/bag";

export default async (req: Request, context: Context) => {
    const baseUrl = process.env.BASEURL === "preview" ? "{BASEURL}" : process.env.BASEURL;
    function FormatMessage(message: string) {
        return new Response("", {
            status: 302, headers: {
                Location: `${baseUrl}/m?portal=${encodeURIComponent(magicKey)}&message=${encodeURIComponent(message)}`,
                'Cache-Control': 'no-cache'
            }
        });
    }

    const magicKey = new URLSearchParams(req.url.split("?")[1]).get("state") as string;
    // get profile information from the slack callback
    const code = new URLSearchParams(req.url.split("?")[1]).get("code");

    if (code === null || magicKey === null) {
        return FormatMessage(`You have not been granted access to the pixie's realm!`);
    }

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
            redirect_uri: `${baseUrl}/.netlify/functions/magic-dust`
        })
    })).json();

    if (!slackToken.ok) {
        return FormatMessage(`It seems you have made my master Mister Slack a tad bit annoyed: ${slackToken.error}`);
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

    // check if the profile is valid
    if (profile === null) {
        return FormatMessage("It seems like you are not a valid user!")
    }

    interface Portal {
        id: string;
        "Loot Count": number;
        "Name": string;
        "Items": string[];
        "Player Visits": number;
        "Status": string;
        "Loot Amount": number;
        "Player ID": string;
    }

    function convertToRecord(obj: any): Portal[] {
        let records: Portal[] = [];

        obj.forEach((record: any) => {
            records.push({
                "id": record.id,
                "Loot Count": record.fields["Loot Count"],
                "Name": record.fields["Name"],
                "Items": record.fields["Items to give out"],
                "Player Visits": record.fields["Player Visits"],
                "Status": record.fields["Status"],
                "Loot Amount": record.fields["Loot Amount"],
                "Player ID": record.fields["Player ID"]
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
        return FormatMessage("The pixie has granted you nothing! You tried to bamboozle the Pixie by spoofing a portal!");
    }

    if (portal.Status !== "Active") {
        return FormatMessage("The pixie has granted you nothing! The portal is currently inactive!");
    }

    const bag = await Bag.connect({
        appId: Number(process.env.BAG_APP_ID),
        key: process.env.BAG_APP_KEY as string
    })

    if (!portal["Player ID"].includes(profile[`https://slack.com/user_id`])) {

        // add the player visit to the portal in the Airtable
        await base('portals').update([
            {
                "id": portal.id,
                "fields": {
                    "Player Visits": portal["Player Visits"] + 1,
                    "Player ID": portal["Player ID"] + ", " + profile[`https://slack.com/user_id`]
                }
            }
        ]);

        let items: Instance[] = [];

        for (const item of portal.Items) {
            console.log({ query: item as string });

            const instance = await bag.createInstance({
                itemId: item,
                identityId: process.env.BAG_IDENTITY_ID as string,
                quantity: portal["Loot Amount"],
                metadata: "",
                public: true,
                show: true,
                note: "A gift from the pixie!",
            });

            items.push(instance);
        }


        const give = await bag.runGive({
            giverId: process.env.BAG_IDENTITY_ID as string,
            receiverId: profile[`https://slack.com/user_id`],
            instances: items
        });

        const inventory = (
            await bag.getInventory({
                identityId: process.env.BAG_IDENTITY_ID as string,
                available: true,
            })
        ).filter((instance) => (portal).Items.includes(instance.itemId as string));

        const notInInventory = (portal).Items.filter((item) => !inventory.map((instance) => instance.itemId).includes(item));

        // check if the inventory has the items that the portal is giving out
        if (notInInventory.length == (portal).Items.length) {
            return FormatMessage("It seems the pixie has ran out of: " + notInInventory + " to give you!");
        }

        function NaturalJoin(arr: string[]): string {
            return arr.map((instance, index) => {
                if (index === arr.length - 1) {
                    return instance;
                } else if (index === arr.length - 2) {
                    return instance + " and";
                } else {
                    return instance + ",";
                }
            }).join(" ");
        }

        return FormatMessage(`The pixie has granted you, ${profile.given_name}, ${NaturalJoin(items.map((item) => item.item?.name) as string[])}!${notInInventory.length > 0 ? ` But the pixie has ran out of: ${NaturalJoin(notInInventory)} to give you!` : ""}`);
    }

    return FormatMessage("The pixie has granted you nothing! You have already visited this portal!");
};