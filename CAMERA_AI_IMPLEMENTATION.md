# Camera AI Feature Implementation Guide

## Overview
The Camera AI feature has been successfully implemented for the B2C donation page. This feature automatically analyzes images using AI to detect products and fill in donation form fields, significantly improving the user experience.

## Architecture Overview

### New Files Created

#### 1. **Type Definitions** - `types/imageAnalysis.ts`
Defines the structure of AI analysis results:
- `AnalyzedProduct` - Individual product detection results
- `ImageAnalysisResult` - Complete analysis with products array
- `ImageAnalysisRequest` - Request parameters
- `ImageAnalysisState` - Hook state management interface

#### 2. **API Client** - `lib/b2cImageAnalysisApi.ts`
Handles communication with the backend AI service:
- `analyzeImageForDonation()` - Sends image to backend for analysis
- Uses FormData for file upload
- Returns structured product detection results

#### 3. **Prompt Management** - `lib/imageAnalysisPrompt.ts`
Manages AI prompts for consistent, high-quality results:
- `buildImageAnalysisSystemPrompt()` - Creates system instructions for AI
- `buildImageAnalysisUserPrompt()` - Creates user query with material context
- `validateAnalysisResult()` - Validates AI response structure
- Helper functions for error messages and summaries

#### 4. **React Hook** - `hooks/useImageAnalysis.ts`
Manages image analysis state and operations:
```typescript
const {
  isLoading,           // Analysis in progress
  result,              // Analysis results
  error,               // Error message if failed
  isCompleted,         // Analysis finished
  analyzeImage,        // Trigger analysis function
  resetAnalysis,       // Clear analysis state
  clearError          // Clear error message
} = useImageAnalysis();
```

#### 5. **Service Layer** - `components/b2c/ImageAnalysisService.ts`
Core business logic for handling analysis results:
- `convertAnalysisResultToFormItems()` - Converts AI results to form state
- `resolveMaterialId()` - Matches detected materials to available options
- `isAnalysisUsable()` - Validates if analysis has usable results
- Helper functions for user messages and validation

## How It Works

### User Flow

1. **Image Selection**
   - User clicks "Chụp ảnh" (capture) or "Upload" button
   - Either selects photo from device or captures with camera

2. **Analysis Trigger**
   - `handleDraftImageChange()` is called
   - Image is displayed with loading indicator
   - AI analysis begins automatically in background

3. **Analysis Progress**
   - Loading state shown with spinner
   - Message: "Camera AI is analyzing your image..."

4. **Analysis Results**
   - **Success**: Shows confidence score and detected items count
   - **Multiple Items**: Shows alert that multiple products detected
   - **Failure**: Shows error message with dismiss option

5. **Auto-Fill Items**
   - When analysis succeeds, donation items are automatically filled
   - Each detected product becomes a separate form item
   - Fields populated: name, type, material, condition, weight estimate

6. **User Review**
   - User proceeds to next step or manually modifies items
   - Can click "Thêm món đồ" (Add item) if manual additions needed
   - Can adjust any auto-filled information

### Technical Flow

```
[User selects image]
        ↓
[handleDraftImageChange triggers]
        ↓
[analyzeImage() called via useImageAnalysis hook]
        ↓
[Image sent to /b2c/analyze-donation-image endpoint]
        ↓
[AI backend analyzes image, returns product detections]
        ↓
[validateAnalysisResult() checks response structure]
        ↓
[UI updates with loading/success/error state]
        ↓
[If successful, useEffect converts results to form items]
        ↓
[Items auto-filled via setItems()]
        ↓
[Toast notification shows summary]
```

## Integration Points in B2CDonationClient

### State Management
```typescript
// Image analysis hook
const {
  isLoading: analysisLoading,
  result: analysisResult,
  error: analysisError,
  isCompleted: analysisCompleted,
  analyzeImage,
  resetAnalysis,
  clearError: clearAnalysisError
} = useImageAnalysis();

// Alert visibility control
const [showAnalysisAlert, setShowAnalysisAlert] = useState(true);
```

### Image Change Handler
- Resets previous analysis
- Triggers new analysis automatically
- Shows analysis alert

### Auto-Fill Effect
- Watches for analysis completion
- Converts AI results to donation items
- Shows toast notifications
- Handles multiple products scenario

### Step 0 UI
- Loading state with spinner
- Success alert with detection summary
- Error alert with retry guidance
- Dismiss buttons for alerts

## Backend API Contract

### Endpoint
```
POST /b2c/analyze-donation-image
```

### Request
```typescript
FormData {
  image: File,          // Required: Image file
  category?: string     // Optional: "charity" or "recycle"
}
```

### Response
```json
{
  "products": [
    {
      "item_name": "Blue Cotton T-shirt",
      "item_type": "shirt",
      "material_id": "cotton",
      "custom_material_name": "",
      "condition": "good",
      "weight_kg": 0.25,
      "confidence": 0.92
    }
  ],
  "total_items_detected": 1,
  "overall_confidence": 0.92
}
```

## Material Mapping

The service automatically maps AI-detected materials to available material rewards:

1. **Exact Match**: Looks for exact material name match
2. **Partial Match**: Checks if detected material contains available material name
3. **Category Match**: Matches by material category
4. **Fallback**: Uses first available material if no match found
5. **Custom Materials**: Preserves custom_material_name for unknown materials

## Error Handling

The system provides user-friendly error messages:

- **Network Error**: "Network error. Please check your connection and try again."
- **Timeout**: "Analysis took too long. Please try again."
- **Invalid Image**: "Unable to process this image. Please try another one."
- **Generic Error**: "Unable to analyze the image. Please try again."

Users can:
- Dismiss error alerts
- Try with a different image
- Manually enter items if analysis fails

## Localization

All UI strings support i18n translation keys with fallbacks:

```
donationWizard.analysis.analyzing
donationWizard.analysis.analyzing_help
donationWizard.analysis.failed
donationWizard.analysis.success
donationWizard.analysis.dismiss
donationWizard.analysis.multipleItemsDetected
donationWizard.analysis.multipleProducts
donationWizard.analysis.itemsAutoFilled
```

## Performance Considerations

1. **Parallel Processing**: Analysis happens while user fills initial form
2. **Lazy Loading**: Analysis only triggered on actual image selection
3. **State Optimization**: Results cached in hook state
4. **Memory Management**: Preview URLs properly revoked

## Testing Scenarios

### Happy Path
1. Upload multi-product image → AI detects all items → Items auto-filled
2. Capture single item → AI detects item → Item auto-filled
3. Multiple items detected → Toast shows count → User prompted to review

### Error Handling
1. Invalid image format → Error alert with message
2. Large image file → Error alert with size message
3. Network failure → Error alert with retry guidance
4. AI timeout → Error alert with retry option

### Edge Cases
1. Empty image → Detection shows 0 items
2. Unclear image → Low confidence warning
3. Unknown materials → Custom material names preserved
4. Mixed product types → Each detected separately

## Future Enhancements

Potential improvements:
- [ ] Batch image analysis (multiple images)
- [ ] Product image cropping and re-analysis
- [ ] High-confidence auto-advance to next step
- [ ] Material confidence indicators per item
- [ ] Undo/redo for auto-filled items
- [ ] AI model selection/customization
- [ ] Analytics on detection accuracy

## Documentation

This implementation follows the codebase patterns and conventions:
- ✓ Modular, reusable components
- ✓ Separate concerns (API, services, hooks, UI)
- ✓ Type-safe with TypeScript
- ✓ Error handling with user feedback
- ✓ Internationalization support
- ✓ Consistent with existing code style
