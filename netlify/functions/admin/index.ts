import type { Context } from "@netlify/functions";
import Airtable from "airtable";

export default async (req: Request, context: Context) => {
    const code = new URLSearchParams(req.url.split("?")[1]).get("code");

    if (code === null || String(code) !== process.env.ADMIN_CODE) {
        return new Response(JSON.stringify({
            ok: false,
            error: "You have not been granted access to the pixie's realm! Invalid code."
        }), {
            status: 400,
            headers: {
                "content-type": "application/json"
            }
        });
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

    return new Response(JSON.stringify({ ok: true, portals: portals }), {
        status: 200,
        headers: {
            "content-type": "application/json"
        }
    });
};