"""
PDF Text Extractor using PyMuPDF (fitz)
For extracting Arabic text from PDFs reliably
"""
import sys
import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file."""
    doc = fitz.open(pdf_path)
    full_text = []
    
    for page_num, page in enumerate(doc, 1):
        text = page.get_text("text")
        if text.strip():
            full_text.append(f"--- صفحة {page_num} ---\n{text}")
    
    doc.close()
    return "\n\n".join(full_text)


def extract_images_from_pdf(pdf_path: str, output_dir: str) -> list:
    """Extract all images from a PDF file."""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    images = []
    
    for page_num, page in enumerate(doc, 1):
        image_list = page.get_images(full=True)
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            image_path = os.path.join(output_dir, f"p{page_num}_img{img_index}.{image_ext}")
            with open(image_path, "wb") as f:
                f.write(image_bytes)
            
            images.append({
                "path": image_path,
                "page": page_num,
                "index": img_index,
                "size": len(image_bytes)
            })
    
    doc.close()
    return images


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_path> [output_dir]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./extracted_images"
    
    print("=== EXTRACTING TEXT ===")
    text = extract_text_from_pdf(pdf_path)
    print(text)
    print(f"\n=== TOTAL: {len(text)} chars ===")
    
    print("\n=== EXTRACTING IMAGES ===")
    images = extract_images_from_pdf(pdf_path, output_dir)
    for img in images:
        print(f"  - {img['path']} ({img['size']} bytes)")
