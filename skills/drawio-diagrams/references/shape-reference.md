# Shape Reference

The dependency-free helper renders these shapes directly:

| `shape` | Use |
|---|---|
| `rectangle` | Components and ordinary steps |
| `rounded` | Services and process steps |
| `ellipse` | Users, starts, ends, and states |
| `diamond` | Decisions |
| `cylinder` | Databases and persistent stores |

For hand-authored native models, common draw.io style fragments include:

| Shape | Style fragment |
|---|---|
| Ellipse | `ellipse;` |
| Diamond | `rhombus;` |
| Cloud | `shape=cloud;` |
| Document | `shape=document;` |
| Database | `shape=cylinder3;` |
| Component | `shape=component;` |
| UML actor | `shape=mxgraph.uml.actor;` |
| Swimlane | `swimlane;startSize=30;` |
| Flowchart I/O | `shape=mxgraph.flowchart.io;` |

Specialized AWS, Azure, GCP, Cisco, BPMN, UML, and network libraries are best
handled by draw.io Desktop or the official `jgraph/drawio-mcp` skill. Do not
claim that the lightweight renderer can faithfully display those shapes before
a draw.io re-export.
