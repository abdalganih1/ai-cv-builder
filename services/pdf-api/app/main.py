"""
PDF Text Extractor API - FastAPI Server
For use with VPS deployment (Docker)
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fitz  # PyMuPDF
import base64
import os
from typing import Optional
import tempfile

app = FastAPI(
    title="PDF Text Extractor API",
    description="Extract text and images from PDF files using PyMuPDF",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key for authentication
API_KEY = os.getenv("PDF_API_KEY", "change-me-in-production")


class ExtractionResult(BaseModel):
    success: bool
    text: str
    text_length: int
    images_count: int
    profile_image_base64: Optional[str] = None
    error: Optional[str] = None


def extract_from_pdf(pdf_bytes: bytes) -> dict:
    """Extract text and detect profile images from PDF bytes."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Extract text from all pages
        full_text = []
        for page_num, page in enumerate(doc, 1):
            text = page.get_text("text")
            if text.strip():
                full_text.append(f"--- صفحة {page_num} ---\n{text}")
        
        combined_text = "\n\n".join(full_text)
        
        # Extract images and find potential profile photo
        images_count = 0
        profile_image_base64 = None
        
        for page_num, page in enumerate(doc, 1):
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                images_count += 1
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                width = base_image.get("width", 0)
                height = base_image.get("height", 0)
                
                # Heuristic: Profile photo is usually on page 1, portrait orientation
                if (page_num == 1 and 
                    height > width and
                    5000 < len(image_bytes) < 500000 and
                    profile_image_base64 is None):
                    profile_image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        doc.close()
        
        return {
            "success": True,
            "text": combined_text,
            "text_length": len(combined_text),
            "images_count": images_count,
            "profile_image_base64": profile_image_base64
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "text": "",
            "text_length": 0,
            "images_count": 0
        }


@app.get("/")
async def root():
    return {"status": "ok", "service": "PDF Text Extractor API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/extract", response_model=ExtractionResult)
async def extract_pdf(
    file: UploadFile = File(...),
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Extract text and profile image from a PDF file.
    
    - **file**: PDF file to process
    - **X-API-Key**: API key for authentication
    """
    # Validate API key
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # Read file
    pdf_bytes = await file.read()
    
    # Check file size (50MB max)
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Extract text
    result = extract_from_pdf(pdf_bytes)
    
    return ExtractionResult(**result)


@app.post("/api/extract-base64", response_model=ExtractionResult)
async def extract_pdf_base64(
    data: dict,
    x_api_key: str = Header(None, alias="X-API-Key")
):
    """
    Extract text from a base64-encoded PDF.
    
    - **data.pdf_base64**: Base64-encoded PDF content
    - **X-API-Key**: API key for authentication
    """
    # Validate API key
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    pdf_base64 = data.get("pdf_base64")
    if not pdf_base64:
        raise HTTPException(status_code=400, detail="pdf_base64 is required")
    
    try:
        pdf_bytes = base64.b64decode(pdf_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 encoding")
    
    # Extract text
    result = extract_from_pdf(pdf_bytes)
    
    return ExtractionResult(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
