; Original 2020 code and logic; comments copyedited for clarity.
; Numeric operands use hexadecimal, including values without an h suffix.

; Flow: load
LXI H,2000h ; Point HL to the Celsius input.
MOV A,M ; Copy the input byte into A.

; Flow: zero-check
MVI D,00h
CMP D
CZ LOOP_ZERO ; If Celsius is zero, use the 32 F special case.

; Flow: range-check
MVI C,00h ; Start the quotient at zero.
MVI B,05 ; Use 5 as the divisor.
CMP B
JC LESS_5 ; Skip subtraction when A is less than 5.

; Flow: divide
LOOP_D:
SUB B ; Subtract 5 from the remaining value.
INR  C ; Count one more group of 5.
CMP B
JNC LOOP_D ; Repeat while A is at least 5.

; Flow: remainder-4
LESS_5:
MVI B,00h ; Default remainder contribution is zero.
MVI D,04
MVI E,03
MVI H,02
MVI L,01
CMP D
CZ 4_FOUND

; Flow: remainder-3
CMP E
CZ 3_FOUND

; Flow: remainder-2
CMP H
CZ 2_FOUND

; Flow: remainder-1
CMP L
CZ 1_FOUND

; Flow: quotient
MOV A,C ; Start the product with one copy of the quotient.
MOV H,C ; Keep the quotient in H for repeated addition.
MVI C,9 ; Set the multiplication counter to 9.

; Flow: multiply
LOOP_M:
DCR C ; Decrease the counter.
JZ LOOP_ADD35 ; Finish after eight additional copies of the quotient.
ADD H ; Add another copy of the quotient.
DAA ; Adjust the sum to packed BCD.
JNZ LOOP_M ; Repeat if the adjusted sum is nonzero.

; Flow: add-remainder
LOOP_ADD35: ; Original label retained; the offset below is 32, not 35.
ADD B ; Add the saved rounded remainder contribution.
DAA ; Adjust the addition result to packed BCD.

; Flow: add-32
MVI H,32 ; Load 32h, the packed BCD representation of decimal 32.
ADD H ; Add the Fahrenheit offset.
DAA ; Adjust the final sum to packed BCD.

; Flow: store
LXI H,2001
MOV M,A ; Store the BCD Fahrenheit result.
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
JZ LOOP_FINISH ; Finish the program.

; Flow: zero-store
LOOP_ZERO:
MVI A,32 ; Load packed BCD 32 for 0 C.
LXI H,2001h
MOV M,A
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
JZ LOOP_FINISH

; Flow: save-4
4_FOUND:
MVI B,7 ; Round 4 times 9/5 to 7.
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
RZ ; Return to the caller because Z is 1.

; Flow: save-3
3_FOUND:
MVI B,5 ; Round 3 times 9/5 to 5.
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
RZ ; Return to the caller because Z is 1.

; Flow: save-2
2_FOUND:
MVI B,4 ; Round 2 times 9/5 to 4.
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
RZ ; Return to the caller because Z is 1.

; Flow: save-1
1_FOUND:
MVI B,2 ; Round 1 times 9/5 to 2.
CMP A ; Compare A with itself to set Z to 1; A is unchanged.
RZ ; Return to the caller because Z is 1.

; Flow: halt
LOOP_FINISH:
HLT
