fn main() {
    // Simulated byte array from your dbg! output
    let raw_id: [u8; 20] = [
        47, 108, 105, 98, 97, 102, 108, 95,
        50, 48, 54, 50, 56, 56, 95, 50,
        53, 57, 49, 0,
    ];

    // Convert to string, ignoring the trailing null byte
    let id_str = String::from_utf8_lossy(&raw_id);
    println!("Decoded ID: {}", id_str);

    // Optional: extract numeric parts
    let digits: String = id_str.chars().filter(|c| c.is_ascii_digit()).collect();
    println!("Digits only: {}", digits);

    // Optional: parse specific segment
    let parts: Vec<&str> = id_str.split('_').collect();
    if parts.len() >= 3 {
        println!("Segment 1: {}", parts[1]);
        println!("Segment 2: {}", parts[2]);
    }
}
