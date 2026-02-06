```mermaid
graph 
    %% Start and Intake
    Start([Idea or Problem Statement]) --> Template[Template for Intake]
    Template --> AutoCheck{Automate & identify if AI is required}
    AutoCheck --> Triage[Triage based on set criteria: POC / Pilot / Prod]
    
    Triage --> Intake[Intake Forum]
    subgraph Intake_Process [Intake Governance]
        Intake --> |Replaces CIO Sponsorship + ARB| IntakeDecide{Decision}
        IntakeDecide --> AppAcc[Approve Accelerator]
        IntakeDecide --> AppBAU[Approve BAU]
        IntakeDecide --> Stop[Stop / Comms]
    end

    %% Design Phase
    AppAcc --> Design[Agree Design / Architecture & Capability]
    Design --> Hero[Hero Capability]
    Design --> NewCap[New Capability]
    
    %% POC Stage
    NewCap --> POC[<b>POC Stage</b>]
    Hero --> POC
    POC --> POC_Action[Go ahead and test]
    POC_Action --> POC_App[Offline CAF Approval]

    %% Pilot Stage
    POC_App --> Pilot[<b>Pilot Stage</b>]
    Pilot --> RiskLevel{Risk Level}
    
    RiskLevel -->|Low| DRA[DRA - 3 Days]
    RiskLevel -->|Med| PilotMed[7 Day Approval]
    RiskLevel -->|High| PilotHigh[10 Day Approval]
    
    DRA --> PilotDocs[Additional Questions / Condense Artefacts]
    PilotMed --> PilotDocs
    PilotHigh --> PilotDocs
    
    PilotDocs --> PilotApp[Offline Approval]

    %% Production Stage
    PilotApp --> Prod[<b>Production Stage</b>]
    subgraph Prod_Criteria [Production Controls]
        Prod --> Review[Review Results / Outcome Report]
        Prod --> KPI[Benefits / KPIs]
        Prod --> Cost[Cost Control]
        Prod --> Incremental[Measure New Incremental Risks Only]
    end
    
    Review --> FinalApp[Final Approval - 7 Day Process]
    FinalApp --> End([Live Production])

    %% Styling
    style POC fill:#f9f,stroke:#333
    style Pilot fill:#bbf,stroke:#333
    style Prod fill:#bfb,stroke:#333
    style Intake_Process fill:#eee,stroke:#999
    ```