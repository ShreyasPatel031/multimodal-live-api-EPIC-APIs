import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import searcelogo from '../../assets/images/searce-logo.png';
import heartlogo from '../../assets/images/heart-logo.png';

// Existing Altair graph declaration
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
    required: ["givenName", "familyName", "telecom", "gender"],
  },
};

// Existing Epic Patient search declaration
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

// Updated tool: static doctor time slots declaration (search by name)
const doctorTimeSlotsDeclaration: FunctionDeclaration = {
  name: "get_doctor_time_slots",
  description:
    "Retrieves static doctor time slots available for appointments. If a doctorName is provided, only that doctor's slots are returned; otherwise, slots for all doctors are returned.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      doctorName: {
        type: SchemaType.STRING,
        description: "Name of the doctor (optional)",
      },
    },
    required: [],
  },
};

const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "book_appointment",
  description:
    "Books an appointment for a patient with a doctor at a given day and time. Returns a success response.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      doctorId: {
        type: SchemaType.STRING,
        description: "Unique identifier for the doctor",
      },
      day: {
        type: SchemaType.STRING,
        description:
          "Day of the week for the appointment (e.g., Mon, Tue, Wed...)",
      },
      time: {
        type: SchemaType.STRING,
        description: "Time of the appointment (e.g., 09:00)",
      },
      patientName: {
        type: SchemaType.STRING,
        description: "Name of the patient booking the appointment",
      },
    },
    required: ["doctorId", "day", "time", "patientName"],
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
            text: 'System Instruction: you are a friendly, conversational and helpful assistant that can help with patient care and support. Always start with an introduction and explain that you can help them schedule an appointment with a doctor. Start with checking if they are an existing patient with the hospital. Ask for first name, last name and dob to check and use search_epic_patient tool to check if they exist in the database ( only if it returns a record then confirm their identity by asking them their phone and gender) then ask them if they would like to schedule an appointment.  If they do not exist in the database, tell them that youre going to need more information to create a new patient record. For scheduling an appointment ask them if they have a preferred doctor and if they have a preferred time. If they do not have a preferred doctor, ask them if they would like to see a list of doctors. If they do not have a preferred time, ask them if they would like to see a list of times. Once they find a time and doctor send them a confirmation message and thank them for using your service.',
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        {
          functionDeclarations: [
            declaration,
            createEpicPatientDeclaration,
            searchEpicPatientDeclaration,
            doctorTimeSlotsDeclaration, // Updated doctor time slots tool
            bookAppointmentDeclaration,
          ],
        },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log("got toolcall", toolCall);

      // Handle Altair graph rendering
      const altairCall = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (altairCall) {
        const str = (altairCall.args as any).json_graph;
        setJSONString(str);
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
          const tokenResponse = await fetch("http://localhost:8080/getToken");
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
          const tokenResponse = await fetch("http://localhost:8080/getToken");
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

      // Handle doctor time slots request using doctorName for filtering
      const doctorSlotCall = toolCall.functionCalls.find(
        (fc) => fc.name === doctorTimeSlotsDeclaration.name
      );
      if (doctorSlotCall) {
        const { doctorName } = doctorSlotCall.args as any;

        // Define static time slots for two example doctors
        const doctors = [
          {
            id: "doc1",
            name: "Dr. Alice Smith",
            timeSlots: {
              Mon: [
                "09:00",
                "09:30",
                "10:00",
                "10:30",
                "11:00",
                "11:30",
                "12:00",
              ],
              Tue: [
                "09:00",
                "09:30",
                "10:00",
                "10:30",
                "11:00",
                "11:30",
                "12:00",
              ],
              Wed: [
                "09:00",
                "09:30",
                "10:00",
                "10:30",
                "11:00",
                "11:30",
                "12:00",
              ],
              Thu: [
                "09:00",
                "09:30",
                "10:00",
                "10:30",
                "11:00",
                "11:30",
                "12:00",
              ],
              Fri: [
                "09:00",
                "09:30",
                "10:00",
                "10:30",
                "11:00",
                "11:30",
                "12:00",
              ],
            },
          },
          {
            id: "doc2",
            name: "Dr. Bob Johnson",
            timeSlots: {
              Mon: [
                "13:00",
                "13:30",
                "14:00",
                "14:30",
                "15:00",
                "15:30",
                "16:00",
              ],
              Tue: [
                "13:00",
                "13:30",
                "14:00",
                "14:30",
                "15:00",
                "15:30",
                "16:00",
              ],
              Wed: [
                "13:00",
                "13:30",
                "14:00",
                "14:30",
                "15:00",
                "15:30",
                "16:00",
              ],
              Thu: [
                "13:00",
                "13:30",
                "14:00",
                "14:30",
                "15:00",
                "15:30",
                "16:00",
              ],
              Fri: [
                "13:00",
                "13:30",
                "14:00",
                "14:30",
                "15:00",
                "15:30",
                "16:00",
              ],
            },
          },
        ];

        // If a doctorName is provided, filter based on a case-insensitive check
        const result = doctorName
          ? doctors.filter((doc) =>
              doc.name.toLowerCase().includes(doctorName.toLowerCase())
            )
          : doctors;

        // Return the static doctor time slots
        client.sendToolResponse({
          functionResponses: [
            {
              response: { output: { success: true, data: result } },
              id: doctorSlotCall.id,
            },
          ],
        });
      }

      // Handle appointment booking tool call
      const bookAppointmentCall = toolCall.functionCalls.find(
        (fc) => fc.name === bookAppointmentDeclaration.name
      );
      if (bookAppointmentCall) {
        const { doctorId, day, time, patientName } =
          bookAppointmentCall.args as any;

        // In an actual booking system, you would process the appointment here.
        // This example simply returns a dummy success response.

        const appointmentResponse = {
          success: true,
          appointmentId: "apt-12345", // dummy appointment ID
          message: `Appointment booked for ${patientName} with doctor ${doctorId} on ${day} at ${time}.`,
        };

        client.sendToolResponse({
          functionResponses: [
            {
              response: { output: appointmentResponse },
              id: bookAppointmentCall.id,
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
              src={heartlogo}
              alt="Heart"
              className="heart-logo"
            />
            <div className="logo-text">
              Care Companion
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Altair = memo(AltairComponent);

