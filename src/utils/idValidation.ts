export interface IdValidationResult {
  isValid: boolean;
  errors: string[];
  dateOfBirth?: Date;
  gender?: 'Male' | 'Female';
  citizenship?: 'Citizen' | 'Permanent Resident' | 'Other';
}

export function validateSouthAfricanID(idNumber: string): IdValidationResult {
  const result: IdValidationResult = {
    isValid: true,
    errors: []
  };

  // Length Verification
  if (idNumber.length !== 13) {
    result.errors.push('ID number must be exactly 13 digits');
    result.isValid = false;
    return result;
  }

  // Numeric Check
  if (!/^\d+$/.test(idNumber)) {
    result.errors.push('ID number must contain only numeric digits');
    result.isValid = false;
    return result;
  }

  // Date of Birth Validation
  const year = parseInt(idNumber.substring(0, 2));
  const month = parseInt(idNumber.substring(2, 4));
  const day = parseInt(idNumber.substring(4, 6));
  
  const yearPrefix = year > 22 ? "19" : "20"; // Adjust this based on your requirements
  const fullYear = parseInt(yearPrefix + year);
  const dateOfBirth = new Date(fullYear, month - 1, day);
  
  if (
    isNaN(dateOfBirth.getTime()) ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    result.errors.push('Invalid date of birth in ID number');
    result.isValid = false;
  } else {
    // Check if date is not in the future
    if (dateOfBirth > new Date()) {
      result.errors.push('Date of birth cannot be in the future');
      result.isValid = false;
    } else {
      result.dateOfBirth = dateOfBirth;
    }
  }

  // Gender Determination
  const genderDigits = parseInt(idNumber.substring(6, 10));
  result.gender = genderDigits < 5000 ? 'Female' : 'Male';

  // Citizenship Verification
  const citizenshipDigit = parseInt(idNumber.substring(10, 11));
  switch (citizenshipDigit) {
    case 0:
      result.citizenship = 'Citizen';
      break;
    case 1:
      result.citizenship = 'Permanent Resident';
      break;
    default:
      result.citizenship = 'Other';
      result.errors.push('Invalid citizenship digit');
      result.isValid = false;
  }

  // Luhn Algorithm Validation
  let sum = 0;
  let isSecondDigit = false;
  
  // Process all digits from right to left
  for (let i = idNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(idNumber.charAt(i));
    
    if (isSecondDigit) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isSecondDigit = !isSecondDigit;
  }
  
  if (sum % 10 !== 0) {
    result.errors.push('Invalid ID number checksum');
    result.isValid = false;
  }

  return result;
} 