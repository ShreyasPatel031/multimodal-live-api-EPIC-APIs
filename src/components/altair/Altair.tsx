import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import searcelogo from '../../assets/images/searce-logo.png';
import doctorlogo from '../../assets/images/doctor-logo.png';



// Existing Epic Patient creation declaration
const createEpicPatientDeclaration: FunctionDeclaration = {
  name: "create_epic_patient",
  description: "Creates a patient in Epic systems EHR",
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
    required: ["givenName", "familyName", "telecom", "gender","birthDate"],
  },
};

// Existing Epic Patient search declaration
const searchEpicPatientDeclaration: FunctionDeclaration = {
  name: "search_epic_patient",
  description: "Searches for patients in Epic systems EHR based on full name and birthdate. Save the patientId to use with other tools but do not save it out loud. If a ptient record is found,confirm the patient record is correct using the phone number and gender.",
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
        description:
          "legal sex or FHIR 'gender' parameter (male, female, other, unknown)",
        enum: ["male", "female", "other", "unknown"],
      },
      telecom: {
        type: SchemaType.STRING,
        description: "Patient's phone number match on",
      },
    },
    required: ["givenName", "familyName", "birthDate"],
  },
};

/** DIAGNOSTIC REPORT SEARCH (Requires patientId) **/
const searchEpicDiagnosticReportDeclaration: FunctionDeclaration = {
  name: "search_epic_diagnostic_report",
  description:
    "Searches for DiagnosticReport resources in Epic for a given patient ID. Always call the get_upcoming_appointments first to get the patient ID. Sumarize the report and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "FHIR ID of the patient from get_upcoming_appointments",
      },
    },
    required: ["patientId"],
  },
};

/** GOAL SEARCH (Requires patientId) **/
const searchEpicGoalDeclaration: FunctionDeclaration = {
  name: "search_epic_goal",
  description:
    "Searches for Goal resources in Epic for a given patient. Always call the get_upcoming_appointments first to get the patient ID. Sumarize the Goal and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "FHIR ID of the patient from get_upcoming_appointments",
      },
    },
    required: ["patientId"],
  },
};

/** MEDICATION REQUEST SEARCH (Requires patientId) **/
export const searchEpicMedicationRequestDeclaration: FunctionDeclaration = {
  name: "search_epic_medication_request",
  description:
    "Searches for MedicationRequest resources (R4) in Epic for a given patient. Always call the get_upcoming_appointments first to get the patient ID. Sumarize the medication request and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient from get_upcoming_appointments",
      },
    },
    required: ["patientId"],
  },
};

/** MEDICATION READ (Requires medication ID) **/
const readEpicMedicationDeclaration: FunctionDeclaration = {
  name: "read_epic_medication",
  description:
    "Reads a specific Medication resource by its ID in Epic. You will get medication.id from searching a search_epic_medication_statement. Always call the get_upcoming_appointments first to get the patient ID. This resource is not patient-specific, but is used for detailed medication info. Sumarize the medication and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      medicationId: {
        type: SchemaType.STRING,
        description:
          "The ID of the Medication resource (from a medication statement reference).",
      },
    },
    required: ["medicationId"],
  },
};

/** OBSERVATION (LABS) SEARCH (Requires patientId) **/
const searchEpicObservationDeclaration: FunctionDeclaration = {
  name: "search_epic_observation",
  description:
    "Searches for Observation (Labs) in Epic for a given patient. Always call the get_upcoming_appointments first to get the patient ID. Sumarize the observations and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "FHIR ID of the patient from get_upcoming_appointments",
      },
    },
    required: ["patientId"],
  },
};

/** PROCEDURE SEARCH (Requires patientId) **/
const searchEpicProcedureDeclaration: FunctionDeclaration = {
  name: "search_epic_procedure",
  description:
    "Searches for Procedure (Orders) resources in Epic for a given patient. Always call the search_epic_patient first to get the patient ID. Sumarize the procedures and give a brief summary of the likely situation the patient is in",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "FHIR ID of the patient from search_epic_patient",
      },
    },
    required: ["patientId"],
  },
};

const getUpcomingAppointmentsDeclaration: FunctionDeclaration = {
  name: "get_upcoming_appointments",
  description: "Retrieves a static list of appointments for a physician.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      physicianName: {
        type: SchemaType.STRING,
        description: "Name of physician to filter on",
      },
    },
    required: ["physicianName"],
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
            text: 'You are a helpful AI assistant that supports a PHYSICIAN. \
                  Your role: \
                  Start with this introduction: Hey Dr. Smith - good morning! You have a busy day ahead with upcoming appointments, and I can help you with the medical history for each patient. How can I help? \
                  1) Provide clinical data about the patient by calling the relevant FHIR/Epic tools. \
                  2) The user is a physician asking for info about the patient\'s labs, medication lists, goals, diagnostic reports, or scheduling follow-ups. \
                  3) You need to call get_upcoming_appointments  tool to get the patients that the physician is seeing today. You need to call this function to rin all other tools (DiagnosticReport, Goals, Observations, etc.). Then ask him whether he would like to know information about any of them. If the doctor says yes, prompt the physician for which information he needs - lab reports, patient goals or previous diagnostic reports. Depending on what the physician responds, provide the data by calling relevant FHIR/Epic tools and summarizing the output \
                  4) Provide concise, relevant medical summaries, based on the output of the tools. \
                  5) If asked about a medication\'s details, use \'read_epic_medication\' with the medication ID from a medication statement.',
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        {
          functionDeclarations: [
            createEpicPatientDeclaration,
            searchEpicPatientDeclaration,
            searchEpicDiagnosticReportDeclaration,
            searchEpicGoalDeclaration,
            searchEpicMedicationRequestDeclaration,
            readEpicMedicationDeclaration,
            searchEpicObservationDeclaration,
            searchEpicProcedureDeclaration,
            getUpcomingAppointmentsDeclaration
          ],
        },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log("got toolcall", toolCall);

      async function getEpicToken() {
        const tokenResponse = await fetch("/getToken");
        if (!tokenResponse.ok) {
          throw new Error(`Token fetch error: ${await tokenResponse.text()}`);
        }
        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
      }

      const createPatientCall = toolCall.functionCalls.find(
        (fc) => fc.name === createEpicPatientDeclaration.name
      );
      if (createPatientCall) {
        const { givenName, familyName, telecom, gender, birthDate } =
          createPatientCall.args as any;

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

        const epicUrl =
          "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient";

        try {
          const tokenResponse = await fetch("/getToken");
          if (!tokenResponse.ok) {
            throw new Error(`Token fetch error: ${await tokenResponse.text()}`);
          }
          const tokenData = await tokenResponse.json();
          const token = tokenData.access_token;

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
        const { givenName, familyName, birthDate, gender, telecom } =
          searchPatientCall.args as any;

        const searchParams = new URLSearchParams();
        if (givenName) searchParams.set("given", givenName);
        if (familyName) searchParams.set("family", familyName);
        if (birthDate) searchParams.set("birthdate", birthDate);
        if (gender) searchParams.set("gender", gender);
        if (telecom) searchParams.set("telecom", telecom);

        const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient?${searchParams.toString()}`;

        try {
          const tokenResponse = await fetch("/getToken");
          if (!tokenResponse.ok) {
            throw new Error(`Token fetch error: ${await tokenResponse.text()}`);
          }
          const tokenData = await tokenResponse.json();
          const token = tokenData.access_token;

          const resp = await fetch(epicSearchUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
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
                response: {
                  output: { success: false, error: error.message },
                },
                id: searchPatientCall.id,
              },
            ],
          });
        }
      }

      // 3) DIAGNOSTICREPORT SEARCH
      const diagReportCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicDiagnosticReportDeclaration.name
      );
      if (diagReportCall) {
        const { patientId } = diagReportCall.args as any;
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/DiagnosticReport?patient=${patientId}`;

        try {
          const token = await getEpicToken();
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: diagReportCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: diagReportCall.id,
              },
            ],
          });
        }
      }

      // 4) GOAL SEARCH
      const goalCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicGoalDeclaration.name
      );
      if (goalCall) {
        const { patientId } = goalCall.args as any;
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Goal?patient=${patientId}`;
        try {
          const token = await getEpicToken();
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: goalCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: goalCall.id,
              },
            ],
          });
        }
      }

      const medRequestCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicMedicationRequestDeclaration.name
      );
      if (medRequestCall) {
        const { patientId } = medRequestCall.args as any;
        // Use R4 endpoint for medication requests
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/MedicationRequest?patient=${patientId}`;
      
        try {
          const token = await getEpicToken(); // your utility to fetch /getToken
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
      
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }
          console.log("MedicationRequest search status code:", resp.status);
      
          // Return the data
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: medRequestCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: medRequestCall.id,
              },
            ],
          });
        }
      }
      // 6) READ MEDICATION
      const readMedicationCall = toolCall.functionCalls.find(
        (fc) => fc.name === readEpicMedicationDeclaration.name
      );
      if (readMedicationCall) {
        const { medicationId } = readMedicationCall.args as any;
        // R4 for medication read
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Medication/${medicationId}`;

        try {
          const token = await getEpicToken();
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: readMedicationCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: readMedicationCall.id,
              },
            ],
          });
        }
      }

       // 7) OBSERVATION (Labs) SEARCH
       const obsCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicObservationDeclaration.name
      );
      if (obsCall) {
        const { patientId } = obsCall.args as any;
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation?patient=${patientId}&category=laboratory`;
        try {
          const token = await getEpicToken();
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: obsCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: obsCall.id,
              },
            ],
          });
        }
      }

       // 8) PROCEDURE SEARCH
       const procedureCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicProcedureDeclaration.name
      );
      if (procedureCall) {
        const { patientId } = procedureCall.args as any;
        const epicUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Procedure?patient=${patientId}`;
        try {
          const token = await getEpicToken();
          const resp = await fetch(epicUrl, {
            method: "GET",
            headers: {
              Accept: "application/fhir+json",
              Authorization: `Bearer ${token}`,
            },
          });
          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }

          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: procedureCall.id,
              },
            ],
          });
        } catch (error: any) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: false, error: error.message } },
                id: procedureCall.id,
              },
            ],
          });
        }
      }

      // 9) UPCOMING APPOINTMENTS
      const upcomingApptsCall = toolCall.functionCalls.find(
        (fc) => fc.name === getUpcomingAppointmentsDeclaration.name
      );
      if (upcomingApptsCall) {
        const { physicianName } = upcomingApptsCall.args as any;
        // Return the data as an OUTPUT, not as part of the input parameters
        const data = [
          {
            patientName: "Derrick Lin",
            fhirId: "eq081-VQEgP8drUUqCWzHfw3",
            appointmentTime: "5:00 PM"
          },
          {
            patientName: "Camila Lopez",
            fhirId: "erXuFYUfucBZaryVksYEcMg3",
            appointmentTime: "3:00 PM"
          }
        ];
        // Possibly filter by physicianName if needed
        client.sendToolResponse({
          functionResponses: [
            {
              response: { output: { success: true, data } },
              id: upcomingApptsCall.id,
            },
          ],
        });
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
    <div 
      ref={embedRef} 
    >
      {!jsonString && (
        <div className="logo-container">
          <img 
            src={searcelogo}
            alt="Searce Logo"
          />
          <div className="text-container">
            <img 
              src={doctorlogo}
              alt="Doctor"
              className="doctor-logo"
            />
            <div className="logo-text">
              Doctor Assist
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Altair = memo(AltairComponent);
