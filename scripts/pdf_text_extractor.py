"""
PDF Text Extractor API - Standalone script for Node.js child_process
Usage: python pdf_text_extractor.py <pdf_path>
Returns: JSON with extracted text and images
"""
import sys
import json
import base64
import os
import fitz  # PyMuPDF


def extract_from_pdf(pdf_path: str) -> dict:
    """Extract text and detect profile images from a PDF file."""
    try:
        doc = fitz.open(pdf_path)
        
        # Extract text from all pages
        full_text = []
        for page_num, page in enumerate(doc, 1):
            text = page.get_text("text")
            if text.strip():
                full_text.append(f"--- صفحة {page_num} ---\n{text}")
        
        combined_text = "\n\n".join(full_text)
        
        # Extract images and find potential profile photo
        images_info = []
        profile_image_base64 = None
        
        for page_num, page in enumerate(doc, 1):
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image.get("width", 0)
                height = base_image.get("height", 0)
                
                img_info = {
                    "page": page_num,
                    "index": img_index,
                    "ext": image_ext,
                    "size": len(image_bytes),
                    "width": width,
                    "height": height
                }
                images_info.append(img_info)
                
                # Heuristic: Profile photo is usually on page 1, portrait orientation, reasonable size
                if (page_num == 1 and 
                    height > width and  # Portrait orientation
                    5000 < len(image_bytes) < 500000 and  # Reasonable file size
                    profile_image_base64 is None):
                    profile_image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    img_info["is_profile_candidate"] = True
        
        doc.close()
        
        return {
            "success": True,
            "text": combined_text,
            "text_length": len(combined_text),
            "images_count": len(images_info),
            "images": images_info,
            "profile_image_base64": profile_image_base64
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "text": "",
            "images": []
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No PDF path provided"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    
    result = extract_from_pdf(pdf_path)
    print(json.dumps(result, ensure_ascii=False))
