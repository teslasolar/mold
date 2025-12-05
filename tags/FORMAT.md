# Tag & UDT File Format Specification

Token-efficient formats for PLC/SCADA tag definitions. Target: <250 tokens per file.

## .udt Format (User Defined Type)

```
#UDT:Name:Version
@base:ParentUDT
$std:ISA_Standard
%cat:Category
---
member:TYPE:default:description
member:TYPE:default:description
```

### Header Lines (# @ $ %)
- `#UDT:Name:Version` — Required. Type name and version
- `@base:Parent` — Optional. Inheritance from parent UDT
- `$std:S88|S95|HMI` — Optional. ISA standard reference
- `%cat:Category` — Optional. Grouping category

### Member Definition
```
name:TYPE:default:desc
```

### Types (Short Codes)
| Code | Type | Code | Type |
|------|------|------|------|
| B | BOOL | R | REAL |
| I | INT | D | DINT |
| S | STRING | T | TIME |
| DT | DATE_TIME | A[] | Array |
| U:Name | UDT ref | E:Name | Enum |

### Example
```
#UDT:Valve:1.0
@base:S88_CM
$std:S88
%cat:Equipment
---
cmd:B:0:Command
fb:B:0:Feedback
flt:B:0:Fault
mode:E:Mode:0:Operating mode
pos:R:0:Position %
```

---

## .tag Format (Tag Instance)

```
#TAG:Name:UDTType
@path:Controller/Path
$inst:InstanceOf
%id:UUID
---
member:value
member:value
```

### Header Lines
- `#TAG:Name:UDT` — Required. Instance name and UDT type
- `@path:Path` — Required. Controller path
- `$inst:Template` — Optional. Instance of template
- `%id:XXXX` — Optional. Short UUID (4 hex chars)

### Member Values
Only non-default values needed.

### Example
```
#TAG:XV001:Valve
@path:Main/Area1/Unit1
$inst:Inlet_Valve
%id:A1B2
---
mode:1
pos:100
```

---

## Multi-Part Files

For UDTs/tags >250 tokens, split with common naming:

```
TypeName-XXXX.udt      (base definition)
TypeName-XXXX-a.udt    (part a)
TypeName-XXXX-b.udt    (part b)
```

UUID format: 4-char hex (0000-FFFF = 65536 unique IDs)

---

## Directory Structure

```
tags/
├── udt/
│   ├── s88/           # ISA-88 UDTs
│   ├── s95/           # ISA-95 UDTs
│   ├── hmi/           # ISA-101 UDTs
│   └── mold/          # Project-specific
├── instance/
│   ├── equipment/     # Equipment tags
│   ├── process/       # Process tags
│   └── hmi/           # HMI tags
└── template/          # Reusable templates
```
