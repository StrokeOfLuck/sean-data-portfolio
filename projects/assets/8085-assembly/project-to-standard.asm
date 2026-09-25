//TESTING//
//LXI H,7000  ;Start of counter function from 0 to 37 Celsius in hex 0 to 25
//MOV A,M ;Places counter number in accumulator starting at 0
//MVI B,26 ;Places 26 in B, utilized with CMP B below this
//CMP B ;If the counter has hit 26, this sets the zero flag to one
//JZ LOOP_FINISH ;Jumps to halt loop if number is at 26 (max number completed 25 in hex *37 in decimal/Celsius*)
//MVI H,30  ;Utilized for testing all numbers in the 30XX memory blocks
//MOV L,A    ;Utilized for testing all numbers in the 30XX; this utilizes the counter so a unique memory block is created for each increase in Celsius
//TESTING//

//PROJECT//
LXI H,2000h
MOV A,M
//PROJECT//

MVI D,00h ;Places 00 in register D so one can properly place information at 0 Celsius
CMP D ;This and the JZ right underneath are just checking if Celsius is 0 degrees
CZ LOOP_ZERO ;If the accumulator is at zero, this will go to the zero command to execute the appropriate code and place 32 degrees in Fahrenheit

MVI C,00h ;Cleared so quotient starts at zero
MVI B,05 ;Divisor used for subtraction
CMP B ;Checks if A is less than 5
JC LESS_5 ;Jumps to LESS_5 code if the number in A is less than 5
LOOP_D: ;The loop for "division"; in reality, one is taking the original Celsius number and subtracting 5 from it until it is equal to or less than 5
SUB B ;Original number minus 5 happens here
INR  C ;Counts up the quotient, i.e. the number of times 5 goes into the original Celsius number
CMP B ;Compares remainder and divisor
JNC LOOP_D ;If a carry flag is created, that means 5 is equal to or greater than the original Celsius number at this point—if the carry flag has NOT been created yet, this will loop back through the division loop

LESS_5:
MVI B,00h ;Sets B to zero so if a remainder doesn't replace it, nothing will be added incorrectly later
MVI D,04 ;Utilized to see if there's a 4 for the remainder
MVI E,03 ;Utilized to see if there's a 3 for the remainder
MVI H,02 ;Utilized to see if there's a 2 for the remainder
MVI L,01 ;Utilized to see if there's a 1 for the remainder
CMP D ;If remainder is 4, zero flag will be set to 1
CZ 4_FOUND ;Jumps to 4_FOUND if zero flag is set by CMP
CMP E  ;If remainder is 3, zero flag will be set to 1
CZ 3_FOUND ;Jumps to 3_FOUND if zero flag is set by CMP
CMP H ;If remainder is 2, zero flag will be set to 1
CZ 2_FOUND ;Jumps to 2_FOUND if zero flag is set by CMP
CMP L ;If remainder is 1, zero flag will be set to 1
CZ 1_FOUND ;Jumps to 1_FOUND if zero flag is set by CMP


MOV A,C ;Putting the quotient in the accumulator
MOV H,C  ;Putting the quotient in a register block (H), needed to add things properly in multiplication
MVI C,9 ;Number of additions we want to happen (multiplied by 9)
LOOP_M: ;The loop for "multiplication" of 9; in reality, one is taking the original Celsius number we divided by 5 and adding the same number 9 times
DCR C ;Counting down from 9
JZ LOOP_ADD35 ;To stop an additional extra number from happening, this is here; otherwise, we would have a multiplication of 10 instead of 9
ADD H ;Adds the original number divided by 5; will be counting up in accumulator
DAA ;We need to start correcting for BCD form here (at the point of addition) so values can be displayed correctly
JNZ LOOP_M ;Loops back on the countdown from 9 since zero has not been hit yet

LOOP_ADD35: ;Adds 35 to complete problem
ADD B ;This contains any calculated remainder number if any call functions were utilized
DAA
MVI H,32 ;This value is not in hex; think of this as adding 32 in decimals
ADD H ;Adds 32 in DECIMALS! as we utilized the DAA function and are thinking in 10s complement and NOT hex's 16 complement form
DAA ;Corrects from 16 complements form (hex) to 10 complements form (decimal) if something happened in this final addition


//TESTING//
//MOV B,A ;Moves final addition to register B to do testing, as accumulator is needed
//LXI H,7000 ;Goes to our counter register
//MOV A,M ;Places counter register in accumulator to update
//MVI H,30 ;Sets up MSB
//MOV L,A ;Implements LSB, which is dictated by counter
//MOV A,B ;Places final Fahrenheit calculation back into accumulator
//MOV M,A ;Places final Fahrenheit in unique memory block
//LXI H,7000 ;Sets HL registers back to counter memory block (7000)
//MOV A,M ;Places counter number back in accumulator
//INR A ;Increases counter by 1
//MOV M,A ;Moves updated counter to memory block 7000
//CMP A ;Throws the zero flag to 1
//JZ 0000  ;Sends things back to the start to start over and do the entire range of Celsius 0-37 (0 to 25 in hex)
//TESTING//

//PROJECT//
LXI H,2001
MOV M,A
CMP A
JZ LOOP_FINISH
//PROJECT//

LOOP_ZERO: ;If degrees is 0, this loop will assure we actually output the correct number; otherwise, it will create an infinite loop in the division loop
MVI A,32 ;If Celsius is zero, Fahrenheit is 32

//TESTING
//LXI H,3000h ;Sets up to place 32 in memory block 3000
//MOV M,A ;Places Fahrenheit at 0 Celsius
//LXI H,7000 ;Sets up to place 1 in memory block 7000
//MVI A,01 ;Places 1 in accumulator to put in memory block 7000
//MOV M,A ;Places 1 in memory block 7000
//CMP A ;Throws the zero flag
//RZ ;Return to original carry
//TESTING


//PROJECT
LXI H,2001h ;Sets up to place 32 in memory block 3000
MOV M,A ;Places Fahrenheit at 0 Celsius
CMP A ;Throws the zero flag
JZ LOOP_FINISH ;Finishes program
//PROJECT


4_FOUND:     ;All Number_FOUND are correlated with any remainders found during the division function; these store the correct remainder number, i.e. number_less_than_5/5*9 = X, so it can be added later; ALSO USED FOR NUMBERS 5 WHICH HAVE NO REMAINDER
MVI B,7 ;Created from 4/5*9; remainder number is placed in register B so we can add it later after the divided number has been multiplied 9 times

CMP A  ;Used to throw zero flag so we can return to the original function
RZ ;Return to original carry

3_FOUND: ;All Number_FOUND are correlated with any remainders found during the division function; these store the correct remainder number, i.e. number_less_than_5/5*9 = X, so it can be added later; ALSO USED FOR NUMBERS 5 WHICH HAVE NO REMAINDER
MVI B,5 ;Created from 3/5*9; remainder number is placed in register B so we can add it later after the divided number has been multiplied 9 times

CMP A   ;Used to throw zero flag so we can return to the original function
RZ ;Return to original carry


2_FOUND: ;All Number_FOUND are correlated with any remainders found during the division function; these store the correct remainder number, i.e. number_less_than_5/5*9 = X, so it can be added later; ALSO USED FOR NUMBERS 5 WHICH HAVE NO REMAINDER
MVI B,4 ;Created from 2/5*9; remainder number is placed in register B so we can add it later after the divided number has been multiplied 9 times

CMP A   ;Used to throw zero flag so we can return to the original function
RZ ;Return to original carry


1_FOUND: ;All Number_FOUND are correlated with any remainders found during the division function; these store the correct remainder number, i.e. number_less_than_5/5*9 = X, so it can be added later; ALSO USED FOR NUMBERS 5 WHICH HAVE NO REMAINDER
MVI B,2 ;Created from 1/5*9; remainder number is placed in register B so we can add it later after the divided number has been multiplied 9 times

CMP A   ;Used to throw zero flag so we can return to the original function
RZ ;Return to original carry

LOOP_FINISH:
HLT
