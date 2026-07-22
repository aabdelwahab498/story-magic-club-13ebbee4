# API Contract Validation

## Authentication DTOs
- **LoginDto**: Enforces `@IsEmail()` and `@IsString()` via `class-validator`. Strong typing. Status 201 on success, 401 on Unauthorized.
- **RegisterDto**: Enforces `@IsEmail()`, `@IsString()`, and `@IsOptional()` display name. Status 201 on success.

## Children DTOs
- **CreateChildProfileDto**: Thoroughly typed with `@IsString()`, `@IsInt()`, `@IsEnum(Language)`, `@IsArray()`, and `@IsEnum(ReadingLevel)`. 
- **UpdateChildProfileDto**: Partial variant using `@IsOptional()` strictly applied to all fields.
- **Frontend Compatibility**: Perfectly compatible with the UI forms required by Lovable React app.

## Stories DTOs
- **CreateStoryRequestDto**: Highly strict. Utilizes `@IsString()` for title and prompt, `@IsNumber()` for optional lengths, and `@IsObject()` for optional parameters. 
- **UpdateStoryStatusDto**: Restricts updates safely using `@IsEnum(StoryStatus)`.
- **Frontend Compatibility**: Compatible. The frontend orchestrator expects the `CreateStoryRequestDto` payload to match strictly what the NestJS backend now requires.

## Error Responses
NestJS leverages global exception filters resulting in a standardized shape:
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```
*Note: The frontend API client must map these to standard UI toasts safely.*
