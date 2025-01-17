
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

import image from "../../assets/image.png"


const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};


const createEpicPatientDeclaration: FunctionDeclaration = {
  name: "create_epic_patient",
  description:
    "Creates a patient in Epic systems EHR",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      givenName: {
        type: SchemaType.STRING,
        description: "Patient's given (first) name",
      },
      familyName: {
        type: SchemaType.STRING,
        description: "Patient's family (last) name",
      },
      telecom: {
        type: SchemaType.STRING,
        description: "Patient's telecom info (e.g. phone number)",
      },
      gender: {
        type: SchemaType.STRING,
        description: "Patient's gender (male, female, other, unknown)",
        enum: ["male", "female", "other", "unknown"],
      },
      birthDate: {
        type: SchemaType.STRING,
        description: "Patient's birth date (YYYY-MM-DD) if needed",
      },
    },
    required: [ "givenName", "familyName", "telecom", "gender"],
  },
};


const searchEpicPatientDeclaration: FunctionDeclaration = {
  name: "search_epic_patient",
  description: "Searches for patients in Epic systems EHR based on demographics.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      givenName: {
        type: SchemaType.STRING,
        description: "Patient's given (first) name",
      },
      familyName: {
        type: SchemaType.STRING,
        description: "Patient's family (last) name",
      },
      birthDate: {
        type: SchemaType.STRING,
        description: "YYYY-MM-DD format birth date",
      },
      gender: {
        type: SchemaType.STRING,
        description: "legal sex or FHIR 'gender' parameter (male, female, other, unknown)",
        enum: ["male", "female", "other", "unknown"],
      },
      telecom: {
        type: SchemaType.STRING,
        description: "Patient's phone number match on",
      },
    },
    required: [],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: 'You are a clinic front office agent responsible for assisting patients with scheduling appointments and managing their records. Your primary tasks include: 1. Identifying Patients: - Prompt the patient to specify if they are an existing patient or a new patient. - For existing patients, collect their name and date of birth to verify their record against the clinics electronic health record (EHR) system using the Epic Systems FHIR API. - For new patients, collect the following details to create a new patient record in the EHR system: Full Name, Date of Birth (DOB), Email Address, Insurance Provider, Insurance Number. 2. Managing Appointments: - Once the patients information is verified or created, fetch a list of available appointment slots. - Present the available slots to the patient and ask them to choose their preferred appointment time. 3. Confirmation: - Confirm the patients details (name, DOB, email, and, if applicable, insurance details) and their selected appointment time. - Record the appointment in the system and inform the patient that their appointment is successfully booked. 4. Behavior Guidelines: - Always communicate in a polite, professional, and empathetic manner. - Use clear and concise language to guide the patient through the process. - Handle errors gracefully by apologizing for any inconvenience and requesting the patient to provide the required information again. 5. Error Handling: - If the FHIR API fails to verify or create a patient record, inform the patient and suggest they contact the clinic for assistance. - If no appointment slots are available, notify the patient and suggest alternative contact methods for rescheduling. Your ultimate goal is to ensure a smooth, user-friendly experience for patients while accurately managing their records and appointments. You may ask clarifying questions to collect missing details, but avoid asking irrelevant questions or providing medical advice.',
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [
          declaration,
          createEpicPatientDeclaration,
          searchEpicPatientDeclaration,
        ] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      
      // Handle Altair graph rendering
      const altairCall = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name,
      );
      if (altairCall) {
        const str = (altairCall.args as any).json_graph;
        setJSONString(str);
      }

      const createPatientCall = toolCall.functionCalls.find(
        (fc) => fc.name === createEpicPatientDeclaration.name
      );
      if (createPatientCall) {
        // Pull dynamic args from the function call
        const {
          givenName,
          familyName,
          telecom,
          gender,
          birthDate,
        } = createPatientCall.args as any;

        // Build the Patient resource from user arguments; 
        // keep identifier = "000-00-0000" or use the passed identifier if you prefer
        const patientBody = {
          resourceType: "Patient",
          identifier: [
            {
              use: "usual",
              system: "urn:oid:2.16.840.1.113883.4.1",
              value: "000-00-0000",
            },
          ],
          active: "true",
          name: [
            {
              use: "usual",
              family: familyName,
              given: [givenName],
            },
          ],
          telecom: [
            {
              system: "phone",
              value: telecom,
              use: "home",
            },
          ],
          gender: gender,
          birthDate: birthDate,
          address: [],
          maritalStatus: { text: "" },
          generalPractitioner: [],
          extension: [],
        };

        // Epic endpoint
        const epicUrl =
          "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient";

        try {
        //   // 1) ***** GET THE TOKEN FROM server.js *****
        //   //    (uncomment below lines to use server-based token approach)
          const tokenResponse = await fetch("http://localhost:8080/getToken");
          if (!tokenResponse.ok) {
            throw new Error(`Token fetch error: ${await tokenResponse.text()}`);
          }
          const tokenData = await tokenResponse.json();
          const token = tokenData.access_token;

        // Bearer token
        // const token ="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ1cm46b2lkOjEuMi44NDAuMTE0MzUwLjEuMTMuMC4xLjcuMy42ODg4ODQuMTAwIiwiY2xpZW50X2lkIjoiZDlmMDdiZTYtMjhjZC00NjlhLWIyYzEtYzY1OTVjYzgxOTAxIiwiZXBpYy5lY2kiOiJ1cm46ZXBpYzpPcGVuLkVwaWMtY3VycmVudCIsImVwaWMubWV0YWRhdGEiOiJJaW94bFVUcUk4RWs3NGY3UkZwcjFSRFFoVjhKNGJzY2JRbjZVQWhRUmZNOTJQYXJYVGZyaW9Ia0lkTXo2R1gyUzVWU1E5NklYYmczR01tLUFnWXBUM1dzMjFVemFjMllBbUZ4cjJpaEFRdzVDQ2N3ZFF4MkYzVUtjdmJjZW1FdCIsImVwaWMudG9rZW50eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzM2NzczNjEwLCJpYXQiOjE3MzY3NzAwMTAsImlzcyI6InVybjpvaWQ6MS4yLjg0MC4xMTQzNTAuMS4xMy4wLjEuNy4zLjY4ODg4NC4xMDAiLCJqdGkiOiI5MWEyODhiMC02MDc5LTRlNzAtOTMwNy0zZTI5NzRmNmRjZTAiLCJuYmYiOjE3MzY3NzAwMTAsInN1YiI6ImV2TnAtS2hZd09PcUFabjFwWjJlbnVBMyJ9.ROL7-dAa6C9mSNK-QkfOQE8i4BbJSS1TokQFiW7oZZ-4Ng6LAaQMERHyxdynCwopaA2k9kiRV8SwTv3izL0MEMighivNPRF-Mo1KiLAz3T2U_qrlsfn6n_zZlnnqlKb1_jSGgMyeaSRApiez_Iq_1IN4JddSxaKQW8i7tx4UgxI2PzCbNSE84nZSmhpY3wVtUEDmssdHZrpwv9FXrganGGSqZipHrPO1XbJNjIjPaD0wDkKkzdt8tRw7Rmrg3y4RZoMLG6gIHc-aarSRgdOXl143fKeYUTsm5A3Chr8WzNcSBpTRbiLxUhLyKLHp8AyO-010ZpF3iLQwfRzdOO8vng";

        const resp = await fetch(epicUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/fhir+json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patientBody),
        });

        console.log("Epic Patient.Create status code:", resp.status);
        console.log("Epic Patient.Create status text:", resp.statusText);

        resp.headers.forEach((value, name) => {
          console.log(`${name}: ${value}`);
        });

        if (resp.status === 201) {
          console.log("Epic indicates 'Created' – check headers for location!");
        }

        let data = null;
        try {
          data = await resp.json();
        } catch (err) {
          console.warn("No JSON body or parse error:", err);
        }
        console.log("Epic Patient.Create response data:", data);

        // Return data to Gemini
        client.sendToolResponse({
          functionResponses: [
            {
              response: { output: { success: resp.ok, data } },
              id: createPatientCall.id,
            },
          ],
        });
      } catch (error: any) {
        console.error("Epic Patient.Create error:", error.message);
        client.sendToolResponse({
          functionResponses: [
            {
              response: { output: { success: false, error: error.message } },
              id: createPatientCall.id,
            },
          ],
        });
      }
      }

      const searchPatientCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicPatientDeclaration.name
      );
      if (searchPatientCall) {
        const {
          givenName,
          familyName,
          birthDate,
          gender,
          telecom,
        } = searchPatientCall.args as any;
  
        // 2) Build a query string
        // e.g. /Patient?given=...&family=...&birthdate=...&gender=...&telecom=...
        const searchParams = new URLSearchParams();
        if (givenName) searchParams.set("given", givenName);
        if (familyName) searchParams.set("family", familyName);
        if (birthDate) searchParams.set("birthdate", birthDate);
        if (gender) searchParams.set("gender", gender);
        if (telecom) searchParams.set("telecom", telecom);
  
        // The base endpoint for searching
        const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient?${searchParams.toString()}`;
  
        try {
          // 3) Retrieve an OAuth token from server.js (or use hardcoded if needed)
          
          const tokenResponse = await fetch("http://localhost:8080/getToken");
          if (!tokenResponse.ok) {
            throw new Error(`Token fetch error: ${await tokenResponse.text()}`);
          }
          const tokenData = await tokenResponse.json();
          const token = tokenData.access_token;
          
  
          // or HARDCODED token again
          // const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJh...";
  
          // 4) Call Epic’s GET /Patient
          const resp = await fetch(epicSearchUrl, {
            method: "GET",
            headers: {
              "Accept": "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
  
          console.log("Epic Patient.Search status code:", resp.status);
          console.log("Epic Patient.Search status text:", resp.statusText);
  
          resp.headers.forEach((value, name) => {
            console.log(`${name}: ${value}`);
          });
  
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }
          console.log("Epic Patient.Search response data:", data);
  
          // 5) Return data to Gemini or wherever
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: searchPatientCall.id,
              },
            ],
          });
        } catch (error: any) {
          console.error("Epic Patient.Search error:", error.message);
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: searchPatientCall.id,
              },
            ],
          });
        }
      }
  };

    

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);


  return (
    <div>
       <img src={image} alt="My Image" />
    </div>
  );
}

export const Altair = memo(AltairComponent);
