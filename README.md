# fuse-backend-test

graph TD
    subgraph Cliente/Usuario
        A[Navegador Web / Aplicación Móvil / Postman]
    end

    subgraph Internet
        B((Internet))
    end

    subgraph Amazon Web Services - AWS Cloud
        subgraph Red Virtual - VPC
            subgraph Subred Pública
                C[Elastic IP EIP o DNS Público EC2]
                D[Security Group Firewall]
                E(EC2 Instance: t2.micro)
                F(EBS Volume: Almacenamiento)
            end
            subgraph Servicios Administrados
                G[DynamoDB Base de Datos NoSQL]
                H[CloudWatch Monitoreo y Logs]
            end
        end
    end

    A --> B
    B --> C
    C --> D
    D -- Permite tráfico (Puertos 80, 443, 22) --> E
    E -- Almacena sistema operativo y código --> F
    E -- Ejecuta: Node.js App, PM2, Nginx (Opcional) --> E
    E -- Llama a API de AWS --> G
    E -- Envía Logs y Métricas --> H

    style A fill:#D0E7F5,stroke:#333,stroke-width:2px,color:#000
    style B fill:#E0E0E0,stroke:#666,stroke-width:2px,color:#000
    style C fill:#FFF2CC,stroke:#FFC107,stroke-width:2px,color:#000
    style D fill:#FFCCCC,stroke:#FF0000,stroke-width:2px,color:#000
    style E fill:#D4EDDA,stroke:#28A745,stroke-width:2px,color:#000
    style F fill:#F8F9FA,stroke:#6C757D,stroke-width:2px,color:#000
    style G fill:#DAF7A6,stroke:#8BC34A,stroke-width:2px,color:#000
    style H fill:#ADD8E6,stroke:#1E90FF,stroke-width:2px,color:#000

    linkStyle 0 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 1 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 2 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 3 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 4 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 5 stroke:#000,stroke-width:1.5px,fill:none;
    linkStyle 6 stroke:#000,stroke-width:1.5px,fill:none;