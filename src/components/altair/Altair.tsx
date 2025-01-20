import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import searcelogo from "../../assets/images/searce-logo.png";
import heartlogo from "../../assets/images/heart-logo.png";

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

// Example: Search MedicationRequest
const searchEpicMedicationRequestDeclaration: FunctionDeclaration = {
  name: "search_epic_medication_request",
  description:
    "Searches for MedicationRequest resources in Epic for a given patient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve MedicationRequests for.",
      },
    },
    required: ["patientId"],
  },
};

// Example: Search DiagnosticReport
const searchEpicDiagnosticReportDeclaration: FunctionDeclaration = {
  name: "search_epic_diagnostic_report",
  description:
    "Searches for DiagnosticReport resources in Epic for a given patient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve DiagnosticReports for.",
      },
    },
    required: ["patientId"],
  },
};

// Example: Search Procedure
const searchEpicProcedureDeclaration: FunctionDeclaration = {
  name: "search_epic_procedure",
  description:
    "Searches for Procedure resources in Epic for a given patient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve Procedures for.",
      },
    },
    required: ["patientId"],
  },
};

// Example: Search MedicationStatement
const searchEpicMedicationStatementDeclaration: FunctionDeclaration = {
  name: "search_epic_medication_statement",
  description:
    "Searches for MedicationStatement resources in Epic for a given patient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve MedicationStatements for.",
      },
    },
    required: ["patientId"],
  },
};

// Example: Search Goal
const searchEpicGoalDeclaration: FunctionDeclaration = {
  name: "search_epic_goal",
  description: "Searches for Goal resources in Epic for a given patient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve Goals for.",
      },
    },
    required: ["patientId"],
  },
};

// Example: Search Observation (Labs)
const searchEpicObservationDeclaration: FunctionDeclaration = {
  name: "search_epic_observation",
  description:
    "Searches for Observation resources in Epic for a given patient (e.g., labs).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      patientId: {
        type: SchemaType.STRING,
        description: "The FHIR ID of the patient to retrieve Observations for.",
      },
    },
    required: ["patientId"],
  },
};

function AltairComponent() {
  // All Hooks must be inside the component function:
  const [jsonString, setJSONString] = useState<string>("");
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);

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
            text: 'System Instruction: you call tools',
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        {
          functionDeclarations: [
            createEpicPatientDeclaration,
            searchEpicPatientDeclaration,
            searchEpicMedicationRequestDeclaration,
            searchEpicDiagnosticReportDeclaration,
            searchEpicProcedureDeclaration,
            searchEpicMedicationStatementDeclaration,
            searchEpicGoalDeclaration,
            searchEpicObservationDeclaration,
          ],
        },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log("got toolcall", toolCall);

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
                response: {
                  output: { success: false, error: error.message },
                },
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

        // Build query with user-provided parameters
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

          let data = null;
          try {
            data = await resp.json();
          } catch (err) {
            console.warn("No JSON body or parse error:", err);
          }

          if (
            resp.ok &&
            data &&
            data.resourceType === "Bundle" &&
            data.entry?.length > 0
          ) {
            // We found at least one matching patient
            const foundPatient = data.entry[0].resource;
            if (foundPatient.id) {
              // Save the ID in state so we can reuse it for future queries
              setCurrentPatientId(foundPatient.id);
            }
          }

          // Return data (success or not) to the agent
          client.sendToolResponse({
            functionResponses: [
              {
                response: { output: { success: resp.ok, data } },
                id: searchPatientCall.id,
              },
            ],
          });
        } catch (error: any) {
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

      // 1) Handle MedicationRequest search
      const medRequestCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicMedicationRequestDeclaration.name
      );
      if (medRequestCall) {
        let { patientId } = medRequestCall.args as any;
        if (!patientId && currentPatientId) {
          // fallback to stored context
          patientId = currentPatientId;
        }
        if (!patientId) {
          // No ID? Return an error
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: medRequestCall.id,
              },
            ],
          });
        } else {
          // e.g. GET /MedicationRequest?patient={patientId}
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/MedicationRequest?patient=${patientId}`;

          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("MedicationRequest search status code:", resp.status);

            let data = null;
            try {
              data = await resp.json();
            } catch (err) {
              console.warn("No JSON body or parse error:", err);
            }

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
                  response: {
                    output: { success: false, error: error.message },
                  },
                  id: medRequestCall.id,
                },
              ],
            });
          }
        }
      }

      // 2) DiagnosticReport search
      const diagReportCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicDiagnosticReportDeclaration.name
      );
      if (diagReportCall) {
        let { patientId } = diagReportCall.args as any;
        if (!patientId && currentPatientId) {
          patientId = currentPatientId;
        }
        if (!patientId) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: diagReportCall.id,
              },
            ],
          });
        } else {
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/DiagnosticReport?patient=${patientId}`;
          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("DiagnosticReport search status code:", resp.status);

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
      }

      // 3) Procedure
      const procedureCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicProcedureDeclaration.name
      );
      if (procedureCall) {
        let { patientId } = procedureCall.args as any;
        if (!patientId && currentPatientId) {
          patientId = currentPatientId;
        }
        if (!patientId) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: procedureCall.id,
              },
            ],
          });
        } else {
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Procedure?patient=${patientId}`;
          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("Procedure search status code:", resp.status);

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
      }

      // 4) MedicationStatement
      const medStatementCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicMedicationStatementDeclaration.name
      );
      if (medStatementCall) {
        let { patientId } = medStatementCall.args as any;
        if (!patientId && currentPatientId) {
          patientId = currentPatientId;
        }
        if (!patientId) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: medStatementCall.id,
              },
            ],
          });
        } else {
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/MedicationStatement?patient=${patientId}`;
          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("MedicationStatement search code:", resp.status);

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
                  id: medStatementCall.id,
                },
              ],
            });
          } catch (error: any) {
            client.sendToolResponse({
              functionResponses: [
                {
                  response: { output: { success: false, error: error.message } },
                  id: medStatementCall.id,
                },
              ],
            });
          }
        }
      }

      // 5) Goal
      const goalCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicGoalDeclaration.name
      );
      if (goalCall) {
        let { patientId } = goalCall.args as any;
        if (!patientId && currentPatientId) {
          patientId = currentPatientId;
        }
        if (!patientId) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: goalCall.id,
              },
            ],
          });
        } else {
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Goal?patient=${patientId}`;
          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("Goal search status code:", resp.status);

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
      }

      // 6) Observation (labs)
      const obsCall = toolCall.functionCalls.find(
        (fc) => fc.name === searchEpicObservationDeclaration.name
      );
      if (obsCall) {
        let { patientId } = obsCall.args as any;
        if (!patientId && currentPatientId) {
          patientId = currentPatientId;
        }
        if (!patientId) {
          client.sendToolResponse({
            functionResponses: [
              {
                response: {
                  output: {
                    success: false,
                    error:
                      "No patient ID provided or found in context. Please search a patient first.",
                  },
                },
                id: obsCall.id,
              },
            ],
          });
        } else {
          const epicSearchUrl = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation?patient=${patientId}`;
          try {
            const tokenResponse = await fetch("http://localhost:8080/getToken");
            if (!tokenResponse.ok) {
              throw new Error(
                `Token fetch error: ${await tokenResponse.text()}`
              );
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
            console.log("Observation search status code:", resp.status);

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
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, currentPatientId]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);

  return (
    <div ref={embedRef}>
      {!jsonString && (
        <div className="logo-container">
          <img src={searcelogo} alt="Searce Logo" />
          <div className="text-container">
            <img src={heartlogo} alt="Heart" className="heart-logo" />
            <div className="logo-text">Care Companion</div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Altair = memo(AltairComponent);
