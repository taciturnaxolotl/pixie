import type { Context } from "@netlify/functions";
import Airtable from "airtable";

export default async (req: Request, context: Context) => {
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    } else if (!req.url.includes('?')) {
        return new Response('Bad Request', { status: 400 });
    } else if (!req.url.includes('portal=')) {
        return new Response('Missing portal parameter', { status: 400 });
    }

    const portal = req.url.split('portal=')[1];

    interface Record {
        "Loot Count": number;
        "Name": string;
        "Items": string[];
        "Player Visits": number;
        "Status": string;
        "Loot Amount": number;
    }

    function convertToRecord(obj: any): Record[] {
        let records: Record[] = [];

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

    // if name = portal, then return the portal
    if (portals.find((record) => record.Name === portal) === undefined) {
        return new Response('Portal not found', { status: 404 });
    }

    const result = portals.find((record) => record.Name === portal);

    const itemsString: string = (result as Record).Items.map((item, index) => {
        if (index === (result as Record).Items.length - 1) {
            return item.replace(/^:-/, "").replace(/:$/, "");
        } else if (index === (result as Record).Items.length - 2) {
            return item.replace(/^:-/, "").replace(/:$/, "") + " and";
        } else {
            return item.replace(/^:-/, "").replace(/:$/, "") + ",";
        }
    }).join(" ");

    const response = {
        statusCode: 302,
        headers: {
            Location: "http://localhost:8888/m/?portal=" + portal + "&items=" + itemsString,
            'Cache-Control': 'no-cache' // Disable caching of this response
        },
        body: '' // return body for local dev
    }

    return new Response(response.body, { status: response.statusCode, headers: response.headers });
};